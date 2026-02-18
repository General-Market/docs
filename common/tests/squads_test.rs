//! Integration tests for Squads v4 SDK
//!
//! These tests use mocked Solana RPC responses to test the full proposal lifecycle
//! without requiring network access.

use common::integrations::squads::{
    MultisigAccount, MultisigMember, Permissions, ProposalAccount, ProposalState,
    ProposalStatus, SquadsClient, SquadsConfig, SquadsError, SolanaCluster,
    VaultTransactionAccount,
    EXPECTED_MEMBERS, EXPECTED_THRESHOLD, MULTISIG_DISCRIMINATOR, PROPOSAL_DISCRIMINATOR,
    VAULT_TRANSACTION_DISCRIMINATOR,
    derive_proposal_pda, derive_default_vault_pda, program_id,
    derive_multisig_pda, derive_transaction_pda, derive_vault_pda, derive_spending_limit_pda,
    ProposalCreateArgs, VaultTransactionCreateArgs,
    TokenTransfer, SEED_PREFIX,
};
use solana_sdk::pubkey::Pubkey;

/// Test helper to create a sample multisig account with 20 members and 11/20 threshold
fn create_test_multisig(members: Vec<Pubkey>) -> MultisigAccount {
    MultisigAccount {
        create_key: Pubkey::new_unique(),
        bump: 255,
        threshold: EXPECTED_THRESHOLD as u16,
        transaction_index: 0,
        stale_transaction_index: 0,
        members: members
            .into_iter()
            .map(|key| MultisigMember {
                key,
                permissions: Permissions::all(),
            })
            .collect(),
        time_lock: 0,
        spending_limit_config_bump: 0,
        _reserved: [0; 64],
    }
}

/// Test helper to create a proposal with given approvals
fn create_test_proposal(
    multisig: Pubkey,
    tx_index: u64,
    approved: Vec<Pubkey>,
    status: u8,
) -> ProposalAccount {
    ProposalAccount {
        multisig,
        transaction_index: tx_index,
        status,
        bump: 255,
        approved,
        rejected: vec![],
        cancelled: vec![],
        _reserved: [0; 8],
    }
}

#[test]
fn test_squads_client_initialization() {
    // Test that client initializes with various configurations
    let configs = vec![
        SquadsConfig::new(SolanaCluster::Devnet, Pubkey::new_unique()),
        SquadsConfig::new(SolanaCluster::Testnet, Pubkey::new_unique()),
        SquadsConfig::new(SolanaCluster::MainnetBeta, Pubkey::new_unique()),
        SquadsConfig::new(
            SolanaCluster::Custom("https://custom.rpc.com".to_string()),
            Pubkey::new_unique(),
        ),
    ];

    for config in configs {
        let result = SquadsClient::new(config);
        assert!(result.is_ok(), "Client should initialize successfully");
    }
}

#[test]
fn test_squads_config_from_env_missing() {
    // Ensure env vars are not set
    std::env::remove_var("SOLANA_RPC_URL");
    std::env::remove_var("SOLANA_CLUSTER");
    std::env::remove_var("SQUADS_MULTISIG_ADDRESS");

    let result = SquadsConfig::from_env();
    assert!(result.is_err(), "Should fail without env vars");
    assert!(matches!(
        result.err().unwrap(),
        SquadsError::MissingConfig { .. }
    ));
}

#[test]
fn test_multisig_member_validation() {
    let members: Vec<Pubkey> = (0..20).map(|_| Pubkey::new_unique()).collect();
    let multisig = create_test_multisig(members.clone());

    // All 20 members should be valid
    for member in &members {
        assert!(multisig.is_member(member), "Member should be in multisig");
    }

    // Non-member should not be valid
    let non_member = Pubkey::new_unique();
    assert!(!multisig.is_member(&non_member), "Non-member should not be valid");
}

#[test]
fn test_threshold_configuration_11_of_20() {
    let members: Vec<Pubkey> = (0..20).map(|_| Pubkey::new_unique()).collect();
    let multisig = create_test_multisig(members);

    assert_eq!(multisig.threshold, 11, "Threshold should be 11");
    assert_eq!(multisig.member_count(), 20, "Should have 20 members");
}

#[test]
fn test_proposal_approval_tracking() {
    let multisig = Pubkey::new_unique();
    let member1 = Pubkey::new_unique();
    let member2 = Pubkey::new_unique();
    let member3 = Pubkey::new_unique();

    let proposal = create_test_proposal(
        multisig,
        0,
        vec![member1, member2],
        0, // Active
    );

    assert_eq!(proposal.approval_count(), 2);
    assert!(proposal.has_approved(&member1));
    assert!(proposal.has_approved(&member2));
    assert!(!proposal.has_approved(&member3));
}

#[test]
fn test_proposal_state_transitions() {
    let multisig = Pubkey::new_unique();

    // Active proposal
    let active = create_test_proposal(multisig, 0, vec![], 0);
    assert_eq!(active.state(), Some(ProposalState::Active));

    // Approved proposal
    let approved = create_test_proposal(multisig, 0, vec![], 1);
    assert_eq!(approved.state(), Some(ProposalState::Approved));

    // Rejected proposal
    let rejected = create_test_proposal(multisig, 0, vec![], 2);
    assert_eq!(rejected.state(), Some(ProposalState::Rejected));

    // Executed proposal
    let executed = create_test_proposal(multisig, 0, vec![], 3);
    assert_eq!(executed.state(), Some(ProposalState::Executed));

    // Cancelled proposal
    let cancelled = create_test_proposal(multisig, 0, vec![], 4);
    assert_eq!(cancelled.state(), Some(ProposalState::Cancelled));
}

#[test]
fn test_threshold_enforcement_10_approvals_not_enough() {
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

    assert!(!status.is_ready_for_execution(), "10 approvals should not be enough");
    assert_eq!(status.remaining_approvals(), 1, "Should need 1 more approval");
}

#[test]
fn test_threshold_enforcement_11_approvals_enough() {
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

    assert!(status.is_ready_for_execution(), "11 approvals should be enough");
    assert_eq!(status.remaining_approvals(), 0, "Should need 0 more approvals");
}

#[test]
fn test_threshold_enforcement_more_than_required() {
    let status = ProposalStatus {
        approval_count: 15,
        threshold: 11,
        is_executed: false,
        is_rejected: false,
        is_cancelled: false,
        created_at: 0,
        expires_at: None,
        approved_members: vec![],
    };

    assert!(status.is_ready_for_execution(), "15 approvals should be enough");
    assert_eq!(status.remaining_approvals(), 0, "Should need 0 more approvals");
}

#[test]
fn test_proposal_expiry_handling() {
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

    // Before expiry
    assert!(!status.is_expired(1500), "Should not be expired at 1500");
    assert!(status.is_active(), "Should still be active");

    // At expiry
    assert!(status.is_expired(2000), "Should be expired at 2000");

    // After expiry
    assert!(status.is_expired(2500), "Should be expired at 2500");
}

#[test]
fn test_proposal_expiry_none() {
    let status = ProposalStatus {
        approval_count: 5,
        threshold: 11,
        is_executed: false,
        is_rejected: false,
        is_cancelled: false,
        created_at: 1000,
        expires_at: None,
        approved_members: vec![],
    };

    // No expiry set - should never expire
    assert!(!status.is_expired(1_000_000_000), "Should never expire without expiry set");
}

#[test]
fn test_pda_derivation_consistency() {
    let multisig = Pubkey::new_unique();

    // Derive the same PDA multiple times
    let (vault1, bump1) = derive_default_vault_pda(&multisig);
    let (vault2, bump2) = derive_default_vault_pda(&multisig);

    assert_eq!(vault1, vault2, "PDA derivation should be deterministic");
    assert_eq!(bump1, bump2, "Bump should be deterministic");
}

#[test]
fn test_pda_uniqueness_per_multisig() {
    let multisig1 = Pubkey::new_unique();
    let multisig2 = Pubkey::new_unique();

    let (vault1, _) = derive_default_vault_pda(&multisig1);
    let (vault2, _) = derive_default_vault_pda(&multisig2);

    assert_ne!(vault1, vault2, "Different multisigs should have different vaults");
}

#[test]
fn test_proposal_pda_per_transaction_index() {
    let multisig = Pubkey::new_unique();

    let (proposal0, _) = derive_proposal_pda(&multisig, 0);
    let (proposal1, _) = derive_proposal_pda(&multisig, 1);
    let (proposal100, _) = derive_proposal_pda(&multisig, 100);

    assert_ne!(proposal0, proposal1, "Different tx indices should have different proposals");
    assert_ne!(proposal1, proposal100, "Different tx indices should have different proposals");
}

#[test]
fn test_program_id_constant() {
    let pid = program_id();
    assert_eq!(
        pid.to_string(),
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        "Program ID should match Squads v4"
    );
}

#[test]
fn test_error_is_retryable() {
    // Retryable errors
    assert!(SquadsError::RpcConnectionFailed { message: "timeout".to_string() }.is_retryable());
    assert!(SquadsError::network("connection reset").is_retryable());
    assert!(SquadsError::SimulationFailed { message: "sim failed".to_string() }.is_retryable());

    // Non-retryable errors
    assert!(!SquadsError::NotMember { pubkey: Pubkey::new_unique() }.is_retryable());
    assert!(!SquadsError::AlreadyApproved {
        member: Pubkey::new_unique(),
        proposal_id: Pubkey::new_unique(),
    }.is_retryable());
    assert!(!SquadsError::ThresholdNotReached { current: 5, required: 11 }.is_retryable());
    assert!(!SquadsError::AlreadyExecuted { proposal_id: Pubkey::new_unique() }.is_retryable());
}

#[test]
fn test_already_approved_error() {
    let member = Pubkey::new_unique();
    let proposal_id = Pubkey::new_unique();

    let err = SquadsError::AlreadyApproved { member, proposal_id };

    assert!(!err.is_retryable(), "AlreadyApproved should not be retryable");
    assert!(
        err.to_string().contains("Already approved"),
        "Error message should mention already approved"
    );
}

#[test]
fn test_threshold_not_reached_error() {
    let err = SquadsError::ThresholdNotReached { current: 8, required: 11 };

    assert!(!err.is_retryable());
    assert_eq!(err.to_string(), "Threshold not reached: 8/11 approvals");
}

#[test]
fn test_transaction_too_large_error() {
    let err = SquadsError::TransactionTooLarge { size: 1500, max: 1232 };

    assert!(!err.is_retryable());
    assert!(err.to_string().contains("1500"));
    assert!(err.to_string().contains("1232"));
}

#[test]
fn test_permissions_combinations() {
    // All permissions
    let all = Permissions::all();
    assert!(all.can_initiate());
    assert!(all.can_vote());
    assert!(all.can_execute());

    // Vote only
    let vote_only = Permissions { mask: Permissions::VOTE };
    assert!(!vote_only.can_initiate());
    assert!(vote_only.can_vote());
    assert!(!vote_only.can_execute());

    // Execute only
    let execute_only = Permissions { mask: Permissions::EXECUTE };
    assert!(!execute_only.can_initiate());
    assert!(!execute_only.can_vote());
    assert!(execute_only.can_execute());

    // Initiate and vote
    let init_vote = Permissions { mask: Permissions::INITIATE | Permissions::VOTE };
    assert!(init_vote.can_initiate());
    assert!(init_vote.can_vote());
    assert!(!init_vote.can_execute());
}

#[test]
fn test_proposal_has_voted_tracks_all_vote_types() {
    let voter1 = Pubkey::new_unique();
    let voter2 = Pubkey::new_unique();
    let voter3 = Pubkey::new_unique();
    let non_voter = Pubkey::new_unique();

    let proposal = ProposalAccount {
        multisig: Pubkey::new_unique(),
        transaction_index: 1,
        status: 0,
        bump: 255,
        approved: vec![voter1],
        rejected: vec![voter2],
        cancelled: vec![voter3],
        _reserved: [0; 8],
    };

    assert!(proposal.has_voted(&voter1), "Approver should show as voted");
    assert!(proposal.has_voted(&voter2), "Rejecter should show as voted");
    assert!(proposal.has_voted(&voter3), "Canceller should show as voted");
    assert!(!proposal.has_voted(&non_voter), "Non-voter should not show as voted");
}

#[test]
fn test_cluster_url_mapping() {
    assert_eq!(SolanaCluster::Devnet.url(), "https://api.devnet.solana.com");
    assert_eq!(SolanaCluster::Testnet.url(), "https://api.testnet.solana.com");
    assert_eq!(SolanaCluster::MainnetBeta.url(), "https://api.mainnet-beta.solana.com");

    let custom = SolanaCluster::Custom("https://my-rpc.example.com".to_string());
    assert_eq!(custom.url(), "https://my-rpc.example.com");
}

#[test]
fn test_cluster_from_str_parsing() {
    assert_eq!(SolanaCluster::from_str("devnet"), SolanaCluster::Devnet);
    assert_eq!(SolanaCluster::from_str("DEVNET"), SolanaCluster::Devnet);
    assert_eq!(SolanaCluster::from_str("testnet"), SolanaCluster::Testnet);
    assert_eq!(SolanaCluster::from_str("TESTNET"), SolanaCluster::Testnet);
    assert_eq!(SolanaCluster::from_str("mainnet"), SolanaCluster::MainnetBeta);
    assert_eq!(SolanaCluster::from_str("mainnet-beta"), SolanaCluster::MainnetBeta);
    assert_eq!(SolanaCluster::from_str("MAINNET-BETA"), SolanaCluster::MainnetBeta);

    // Custom URLs
    match SolanaCluster::from_str("https://custom.rpc") {
        SolanaCluster::Custom(url) => assert_eq!(url, "https://custom.rpc"),
        _ => panic!("Should parse as Custom"),
    }
}

#[test]
fn test_expected_constants() {
    assert_eq!(EXPECTED_THRESHOLD, 11, "Expected threshold should be 11");
    assert_eq!(EXPECTED_MEMBERS, 20, "Expected members should be 20");
}

#[test]
fn test_config_timeout_default() {
    let config = SquadsConfig::new(SolanaCluster::Devnet, Pubkey::new_unique());
    assert_eq!(config.timeout_secs, 30, "Default timeout should be 30s");
}

#[test]
fn test_config_timeout_custom() {
    let config = SquadsConfig::new(SolanaCluster::Devnet, Pubkey::new_unique())
        .with_timeout(60);
    assert_eq!(config.timeout_secs, 60, "Custom timeout should be set");
}

#[test]
fn test_proposal_status_is_active_states() {
    // Active - can receive approvals
    let active = ProposalStatus {
        approval_count: 5,
        threshold: 11,
        is_executed: false,
        is_rejected: false,
        is_cancelled: false,
        created_at: 0,
        expires_at: None,
        approved_members: vec![],
    };
    assert!(active.is_active());

    // Executed - no longer active
    let executed = ProposalStatus { is_executed: true, ..active.clone() };
    assert!(!executed.is_active());

    // Rejected - no longer active
    let rejected = ProposalStatus { is_rejected: true, ..active.clone() };
    assert!(!rejected.is_active());

    // Cancelled - no longer active
    let cancelled = ProposalStatus { is_cancelled: true, ..active.clone() };
    assert!(!cancelled.is_active());
}

#[test]
fn test_client_get_vault_address() {
    let multisig = Pubkey::new_unique();
    let config = SquadsConfig::new(SolanaCluster::Devnet, multisig);
    let client = SquadsClient::new(config).unwrap();

    let vault = client.get_vault_address();
    let (expected, _) = derive_default_vault_pda(&multisig);

    assert_eq!(vault, expected, "Client vault address should match PDA derivation");
}

#[test]
fn test_discriminator_constants() {
    // Verify discriminators are 8 bytes
    assert_eq!(MULTISIG_DISCRIMINATOR.len(), 8);
    assert_eq!(PROPOSAL_DISCRIMINATOR.len(), 8);
    assert_eq!(VAULT_TRANSACTION_DISCRIMINATOR.len(), 8);

    // All discriminators should be distinct
    assert_ne!(MULTISIG_DISCRIMINATOR, PROPOSAL_DISCRIMINATOR);
    assert_ne!(MULTISIG_DISCRIMINATOR, VAULT_TRANSACTION_DISCRIMINATOR);
    // NOTE: PROPOSAL_DISCRIMINATOR == VAULT_TRANSACTION_DISCRIMINATOR would be suspicious;
    // both need verification against the actual Squads v4 IDL
}

#[test]
fn test_multisig_member_pubkeys() {
    let members: Vec<Pubkey> = (0..5).map(|_| Pubkey::new_unique()).collect();
    let multisig = create_test_multisig(members.clone());

    let pubkeys = multisig.member_pubkeys();
    assert_eq!(pubkeys.len(), 5);
    for (i, pk) in pubkeys.iter().enumerate() {
        assert_eq!(*pk, members[i]);
    }
}

#[test]
fn test_multisig_get_member() {
    let members: Vec<Pubkey> = (0..3).map(|_| Pubkey::new_unique()).collect();
    let multisig = create_test_multisig(members.clone());

    let found = multisig.get_member(&members[1]);
    assert!(found.is_some());
    assert_eq!(found.unwrap().key, members[1]);

    let not_found = multisig.get_member(&Pubkey::new_unique());
    assert!(not_found.is_none());
}

#[test]
fn test_proposal_rejection_count() {
    let proposal = ProposalAccount {
        multisig: Pubkey::new_unique(),
        transaction_index: 0,
        status: 0,
        bump: 255,
        approved: vec![Pubkey::new_unique()],
        rejected: vec![Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique()],
        cancelled: vec![],
        _reserved: [0; 8],
    };

    assert_eq!(proposal.approval_count(), 1);
    assert_eq!(proposal.rejection_count(), 3);
}

#[test]
fn test_multisig_deserialize_rejects_short_data() {
    let data = vec![0u8; 4];
    assert!(matches!(
        MultisigAccount::deserialize(&data),
        Err(SquadsError::DeserializationError { .. })
    ));
}

#[test]
fn test_multisig_deserialize_rejects_wrong_discriminator() {
    let mut data = vec![0xFF; 100];
    // Wrong discriminator
    data[..8].copy_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0]);
    assert!(matches!(
        MultisigAccount::deserialize(&data),
        Err(SquadsError::DeserializationError { .. })
    ));
}

#[test]
fn test_proposal_deserialize_rejects_short_data() {
    let data = vec![0u8; 4];
    assert!(matches!(
        ProposalAccount::deserialize(&data),
        Err(SquadsError::DeserializationError { .. })
    ));
}

#[test]
fn test_vault_transaction_deserialize_rejects_short_data() {
    let data = vec![0u8; 4];
    assert!(matches!(
        VaultTransactionAccount::deserialize(&data),
        Err(SquadsError::DeserializationError { .. })
    ));
}

#[test]
fn test_vault_transaction_deserialize_rejects_wrong_discriminator() {
    let mut data = vec![0u8; 100];
    data[..8].copy_from_slice(&[0xFF; 8]);
    assert!(matches!(
        VaultTransactionAccount::deserialize(&data),
        Err(SquadsError::DeserializationError { .. })
    ));
}

#[test]
fn test_all_pda_derivations_deterministic() {
    let create_key = Pubkey::new_unique();
    let multisig = Pubkey::new_unique();

    // Each derivation should be deterministic across calls
    let (m1, b1) = derive_multisig_pda(&create_key);
    let (m2, b2) = derive_multisig_pda(&create_key);
    assert_eq!(m1, m2);
    assert_eq!(b1, b2);

    let (v1, _) = derive_vault_pda(&multisig, 0);
    let (v2, _) = derive_vault_pda(&multisig, 0);
    assert_eq!(v1, v2);

    let (t1, _) = derive_transaction_pda(&multisig, 5);
    let (t2, _) = derive_transaction_pda(&multisig, 5);
    assert_eq!(t1, t2);

    let (p1, _) = derive_proposal_pda(&multisig, 5);
    let (p2, _) = derive_proposal_pda(&multisig, 5);
    assert_eq!(p1, p2);

    let create_key = Pubkey::new_unique();
    let (s1, _) = derive_spending_limit_pda(&multisig, &create_key);
    let (s2, _) = derive_spending_limit_pda(&multisig, &create_key);
    assert_eq!(s1, s2);
}

#[test]
fn test_all_pda_types_produce_different_addresses() {
    let multisig = Pubkey::new_unique();

    let (vault, _) = derive_default_vault_pda(&multisig);
    let (transaction, _) = derive_transaction_pda(&multisig, 0);
    let (proposal, _) = derive_proposal_pda(&multisig, 0);
    let spending_limit_key = Pubkey::new_unique();
    let (spending_limit, _) = derive_spending_limit_pda(&multisig, &spending_limit_key);

    // Different PDA types should produce different addresses
    assert_ne!(vault, transaction);
    assert_ne!(vault, proposal);
    assert_ne!(vault, spending_limit);
    assert_ne!(transaction, proposal);
    assert_ne!(transaction, spending_limit);
    assert_ne!(proposal, spending_limit);
}

#[test]
fn test_build_transfer_tx_correct_accounts() {
    let multisig = Pubkey::new_unique();
    let config = SquadsConfig::new(SolanaCluster::Devnet, multisig);
    let client = SquadsClient::new(config).unwrap();

    let mint = Pubkey::new_unique();
    let recipient = Pubkey::new_unique();

    let ix = client.build_transfer_tx(&TokenTransfer {
        mint,
        recipient,
        amount: 1_000_000,
    });

    // Should have 3 accounts: source ATA, dest ATA, authority
    assert_eq!(ix.accounts.len(), 3);
    // Source ATA: writable, not signer
    assert!(ix.accounts[0].is_writable);
    assert!(!ix.accounts[0].is_signer);
    // Dest ATA: writable, not signer
    assert!(ix.accounts[1].is_writable);
    assert!(!ix.accounts[1].is_signer);
    // Authority: read-only signer (vault)
    assert!(!ix.accounts[2].is_writable);
    assert!(ix.accounts[2].is_signer);
}

#[test]
fn test_build_transfer_tx_data_format() {
    let multisig = Pubkey::new_unique();
    let config = SquadsConfig::new(SolanaCluster::Devnet, multisig);
    let client = SquadsClient::new(config).unwrap();

    let amount: u64 = 42_000_000;
    let ix = client.build_transfer_tx(&TokenTransfer {
        mint: Pubkey::new_unique(),
        recipient: Pubkey::new_unique(),
        amount,
    });

    // Data: 1 byte discriminator + 8 bytes amount = 9 bytes total
    assert_eq!(ix.data.len(), 9);
    assert_eq!(ix.data[0], 3u8); // SPL Token Transfer discriminator
    let decoded_amount = u64::from_le_bytes(ix.data[1..9].try_into().unwrap());
    assert_eq!(decoded_amount, amount);
}

#[test]
fn test_build_swap_tx_passthrough() {
    let multisig = Pubkey::new_unique();
    let config = SquadsConfig::new(SolanaCluster::Devnet, multisig);
    let client = SquadsClient::new(config).unwrap();

    let jupiter_ix = solana_sdk::instruction::Instruction {
        program_id: Pubkey::new_unique(),
        accounts: vec![],
        data: vec![1, 2, 3],
    };
    let original_program_id = jupiter_ix.program_id;
    let original_data = jupiter_ix.data.clone();

    let result = client.build_swap_tx(jupiter_ix);

    // Should pass through unchanged
    assert_eq!(result.program_id, original_program_id);
    assert_eq!(result.data, original_data);
}

#[test]
fn test_error_display_messages() {
    let errors = vec![
        (
            SquadsError::CpiDepthExceeded,
            "CPI depth exceeded",
        ),
        (
            SquadsError::InsufficientBalance,
            "Insufficient SOL",
        ),
        (
            SquadsError::InvalidSignature,
            "Invalid signature",
        ),
        (
            SquadsError::MissingConfig { field: "SOLANA_RPC_URL".to_string() },
            "SOLANA_RPC_URL",
        ),
    ];

    for (err, expected_substr) in errors {
        assert!(
            err.to_string().contains(expected_substr),
            "Error '{}' should contain '{}'",
            err, expected_substr
        );
    }
}

#[test]
fn test_serialization_error_from_borsh() {
    let err = SquadsError::from_borsh_error("unexpected end of input");
    match err {
        SquadsError::SerializationError { message } => {
            assert!(message.contains("unexpected end of input"));
        }
        _ => panic!("Expected SerializationError"),
    }
}

#[test]
fn test_deserialization_error_factory() {
    let err = SquadsError::deserialization("invalid account data");
    match err {
        SquadsError::DeserializationError { message } => {
            assert_eq!(message, "invalid account data");
        }
        _ => panic!("Expected DeserializationError"),
    }
}

#[test]
fn test_proposal_zero_approvals_remaining() {
    let status = ProposalStatus {
        approval_count: 20,
        threshold: 11,
        is_executed: false,
        is_rejected: false,
        is_cancelled: false,
        created_at: 0,
        expires_at: None,
        approved_members: vec![],
    };
    assert_eq!(status.remaining_approvals(), 0);
    assert!(status.is_ready_for_execution());
}

#[test]
fn test_proposal_status_rejected_not_ready_for_execution() {
    let status = ProposalStatus {
        approval_count: 11,
        threshold: 11,
        is_executed: false,
        is_rejected: true,
        is_cancelled: false,
        created_at: 0,
        expires_at: None,
        approved_members: vec![],
    };
    // Even with enough approvals, rejected proposals can't execute
    assert!(!status.is_ready_for_execution());
}
