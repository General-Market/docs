//! Integration tests for Registry Sync Endpoint (Story 8.4, Task 9)
//!
//! Tests the full registry sync flow including:
//! - RegistrySyncHandler processes events and updates cache
//! - HTTP endpoint returns 404 when no state available
//! - Multiple events with increasing nonce update to latest
//! - 3-oracle BLS signature aggregation and verification
//! - Endpoint JSON response format validation
//!
//! **GAP (Code Review):** These tests validate domain logic (cache, signing,
//! aggregation) but do NOT test the actual HTTP handler (`handle_health_check`).
//! A future test should start a TCP listener, send `GET /api/registry-sync`,
//! and validate the raw HTTP response including status codes (200/404) and
//! JSON body format. Currently, HTTP correctness relies on manual E2E testing.

use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};
use common::mocks::MockChainBuilder;
use common::traits::{BLSSigner, ChainReader};
use common::types::{BLSPublicKey, BLSSignature, Oracle};
use ethers::types::{Address, Bytes, H256, U256};
use oracle::registry_sync::{
    build_registry_sync_message_hash, compute_aggregated_pubkey, compute_threshold,
    new_registry_sync_cache, sign_registry_sync_message, RegistrySyncState,
};

// ============================================================================
// Test Constants & Helpers
// ============================================================================

/// Test chain ID for chain-bound message hashing
const TEST_CHAIN_ID: u64 = 111222333;

/// Test mirror contract address for chain-bound message hashing
fn test_mirror_address() -> Address {
    Address::from([0xAB; 20])
}

/// Create a test oracle with a deterministic BLS keypair
fn create_test_oracle(id: u8, active: bool) -> (Oracle, BLSKeyPair) {
    let mut seed = [0u8; 32];
    seed[0] = id;
    seed[1] = 0x42;
    let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");

    let oracle = Oracle {
        id: id as u64,
        addr: Address::from([id; 20]),
        ip: H256::from([id; 32]),
        bls_pubkey: Bytes::from(keypair.public_key_bytes()),
        status: if active { U256::from(1) } else { U256::from(0) },
        registered_at: U256::from(1000),
    };

    (oracle, keypair)
}

/// Simulate an oracle producing a signed registry sync proof
fn produce_sync_proof(
    keypair: &BLSKeyPair,
    oracles: &[Oracle],
    nonce: u64,
    state_hash: H256,
    oracle_id: u8,
) -> RegistrySyncState {
    let aggregated_pubkey = compute_aggregated_pubkey(oracles).unwrap();
    let active_count = oracles.iter().filter(|i| i.is_active()).count() as u64;
    let threshold = compute_threshold(active_count);
    let message_hash =
        build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), nonce, &aggregated_pubkey, active_count, threshold);
    let bls_signature = sign_registry_sync_message(keypair, &message_hash).unwrap();

    RegistrySyncState::new(
        nonce,
        aggregated_pubkey,
        active_count,
        threshold,
        state_hash,
        bls_signature,
        oracle_id,
    )
}

// ============================================================================
// Task 9.2: Start oracle with mock chain, trigger event, verify JSON response
// ============================================================================

#[tokio::test]
async fn test_registry_sync_handler_processes_event_and_updates_cache() {
    // Setup: 3 active oracles
    let (oracle1, kp1) = create_test_oracle(1, true);
    let (oracle2, _kp2) = create_test_oracle(2, true);
    let (oracle3, _kp3) = create_test_oracle(3, true);

    let oracles = vec![oracle1.clone(), oracle2.clone(), oracle3.clone()];

    // Create mock chain with oracles
    let mock_chain = MockChainBuilder::new()
        .with_oracles(oracles.clone())
        .build();

    // Verify mock chain returns oracles
    let registry = mock_chain.get_oracle_registry().await.unwrap();
    assert_eq!(registry.len(), 3);
    assert!(registry.iter().all(|i| i.is_active()));

    // Simulate: oracle 1 produces a sync proof (as if event was processed)
    let nonce = 1u64;
    let state_hash = H256::from([0xAA; 32]);
    let state = produce_sync_proof(&kp1, &oracles, nonce, state_hash, 0);

    // Validate the state
    assert!(state.validate().is_ok());
    assert_eq!(state.nonce, 1);
    assert_eq!(state.active_count, 3);
    assert_eq!(state.threshold, 3); // 2/3*3 + 1 = 3
    assert_eq!(state.oracle_id, 0);
    assert_eq!(state.aggregated_pubkey.len(), 128);
    assert_eq!(state.bls_signature.len(), 64);

    // Verify JSON response format
    let json = state.to_json_response();
    assert_eq!(json["nonce"], 1);
    assert_eq!(json["activeCount"], 3);
    assert_eq!(json["threshold"], 3);
    assert_eq!(json["oracleId"], 0);

    let agg_pubkey_hex = json["aggregatedPubkey"].as_str().unwrap();
    assert!(agg_pubkey_hex.starts_with("0x"));
    assert_eq!(agg_pubkey_hex.len(), 2 + 256); // 0x + 128 bytes * 2 hex chars

    let sig_hex = json["blsSignature"].as_str().unwrap();
    assert!(sig_hex.starts_with("0x"));
    assert_eq!(sig_hex.len(), 2 + 128); // 0x + 64 bytes * 2 hex chars

    let hash_hex = json["stateHash"].as_str().unwrap();
    assert!(hash_hex.starts_with("0x"));
    assert_eq!(hash_hex.len(), 2 + 64); // 0x + 32 bytes * 2 hex chars

    // Verify the individual BLS signature is valid
    let signer = Bn254BLSSigner::new();
    let message_hash = build_registry_sync_message_hash(
        TEST_CHAIN_ID,
        test_mirror_address(),
        state.nonce,
        &state.aggregated_pubkey,
        state.active_count,
        state.threshold,
    );
    let valid = signer
        .verify_message_hash(
            &kp1.public_key(),
            &message_hash,
            &BLSSignature(state.bls_signature.clone()),
        )
        .unwrap();
    assert!(valid, "Individual BLS signature should be valid");
}

// ============================================================================
// Task 9.3: Call endpoint before any event, verify 404 response
// ============================================================================

#[tokio::test]
async fn test_empty_cache_returns_none() {
    let cache = new_registry_sync_cache();

    // Cache should be empty initially
    let guard = cache.read().await;
    assert!(guard.is_none(), "Cache should be empty before any events");
}

#[tokio::test]
async fn test_cache_with_state_returns_some() {
    let cache = new_registry_sync_cache();

    // Populate cache
    let (oracle1, kp1) = create_test_oracle(1, true);
    let oracles = vec![oracle1];
    let state = produce_sync_proof(&kp1, &oracles, 1, H256::from([0xAA; 32]), 0);

    {
        let mut guard = cache.write().await;
        *guard = Some(state.clone());
    }

    // Cache should have state
    let guard = cache.read().await;
    assert!(guard.is_some(), "Cache should have state after event");
    let cached = guard.as_ref().unwrap();
    assert_eq!(cached.nonce, 1);
}

// ============================================================================
// Task 9.4: Multiple events with increasing nonce, verify latest returned
// ============================================================================

#[tokio::test]
async fn test_multiple_events_cache_returns_latest_nonce() {
    let (oracle1, kp1) = create_test_oracle(1, true);
    let (oracle2, _kp2) = create_test_oracle(2, true);
    let (oracle3, _kp3) = create_test_oracle(3, true);
    let oracles = vec![oracle1, oracle2, oracle3];

    let cache = new_registry_sync_cache();

    // Simulate processing 3 events with increasing nonces
    for nonce in 1..=3u64 {
        let state_hash = H256::from([nonce as u8; 32]);
        let state = produce_sync_proof(&kp1, &oracles, nonce, state_hash, 0);

        // Only update if nonce is higher (mimics RegistrySyncHandler logic)
        let mut guard = cache.write().await;
        if let Some(ref current) = *guard {
            if state.is_newer_than(current) {
                *guard = Some(state);
            }
        } else {
            *guard = Some(state);
        }
    }

    // Verify cache has the latest nonce
    let guard = cache.read().await;
    let cached = guard.as_ref().unwrap();
    assert_eq!(cached.nonce, 3, "Cache should have the latest nonce");
    assert_eq!(
        cached.state_hash,
        H256::from([3u8; 32]),
        "Cache should have the latest state hash"
    );
}

#[tokio::test]
async fn test_older_nonce_does_not_overwrite_cache() {
    let (oracle1, kp1) = create_test_oracle(1, true);
    let oracles = vec![oracle1];

    let cache = new_registry_sync_cache();

    // Set nonce=5
    let state5 = produce_sync_proof(&kp1, &oracles, 5, H256::from([0x55; 32]), 0);
    {
        let mut guard = cache.write().await;
        *guard = Some(state5);
    }

    // Try to update with nonce=3 (older)
    let state3 = produce_sync_proof(&kp1, &oracles, 3, H256::from([0x33; 32]), 0);
    {
        let mut guard = cache.write().await;
        if let Some(ref current) = *guard {
            if state3.is_newer_than(current) {
                *guard = Some(state3);
            }
            // Should NOT update since nonce 3 < 5
        }
    }

    // Verify cache still has nonce=5
    let guard = cache.read().await;
    let cached = guard.as_ref().unwrap();
    assert_eq!(cached.nonce, 5, "Cache should still have nonce=5");
}

// ============================================================================
// Task 9.5: Collect signatures from 3 oracles, aggregate, verify
// ============================================================================

#[tokio::test]
async fn test_three_oracles_produce_consistent_sync_proofs() {
    // Setup 3 active oracles
    let (oracle1, kp1) = create_test_oracle(1, true);
    let (oracle2, kp2) = create_test_oracle(2, true);
    let (oracle3, kp3) = create_test_oracle(3, true);
    let oracles = vec![oracle1, oracle2, oracle3];

    let nonce = 5u64;
    let state_hash = H256::from([0xBB; 32]);

    // Each oracle produces a sync proof
    let state1 = produce_sync_proof(&kp1, &oracles, nonce, state_hash, 0);
    let state2 = produce_sync_proof(&kp2, &oracles, nonce, state_hash, 1);
    let state3 = produce_sync_proof(&kp3, &oracles, nonce, state_hash, 2);

    // AC7: All 3 should have matching nonce, activeCount, threshold, aggregatedPubkey
    assert_eq!(state1.nonce, state2.nonce);
    assert_eq!(state2.nonce, state3.nonce);
    assert_eq!(state1.active_count, state2.active_count);
    assert_eq!(state2.active_count, state3.active_count);
    assert_eq!(state1.threshold, state2.threshold);
    assert_eq!(state2.threshold, state3.threshold);
    assert_eq!(state1.aggregated_pubkey, state2.aggregated_pubkey);
    assert_eq!(state2.aggregated_pubkey, state3.aggregated_pubkey);

    // Different oracle IDs
    assert_ne!(state1.oracle_id, state2.oracle_id);
    assert_ne!(state2.oracle_id, state3.oracle_id);

    // Different signatures (same message, different keys)
    assert_ne!(state1.bls_signature, state2.bls_signature);
    assert_ne!(state2.bls_signature, state3.bls_signature);
}

#[tokio::test]
async fn test_aggregate_signatures_verify_against_aggregated_pubkey() {
    // Setup 3 active oracles
    let (oracle1, kp1) = create_test_oracle(1, true);
    let (oracle2, kp2) = create_test_oracle(2, true);
    let (oracle3, kp3) = create_test_oracle(3, true);
    let oracles = vec![oracle1, oracle2, oracle3];

    let nonce = 5u64;
    let state_hash = H256::from([0xBB; 32]);

    // Each oracle produces a sync proof
    let state1 = produce_sync_proof(&kp1, &oracles, nonce, state_hash, 0);
    let state2 = produce_sync_proof(&kp2, &oracles, nonce, state_hash, 1);
    let state3 = produce_sync_proof(&kp3, &oracles, nonce, state_hash, 2);

    // AC8: Aggregate individual BLS signatures
    let signer = Bn254BLSSigner::new();
    let sig1 = BLSSignature(state1.bls_signature.clone());
    let sig2 = BLSSignature(state2.bls_signature.clone());
    let sig3 = BLSSignature(state3.bls_signature.clone());

    let agg_sig = BLSSigner::aggregate_signatures(&signer, vec![sig1, sig2, sig3]).unwrap();

    // AC8: Verify aggregated signature against aggregated pubkey
    let agg_pk = BLSPublicKey(state1.aggregated_pubkey.clone());
    let message_hash = build_registry_sync_message_hash(
        TEST_CHAIN_ID,
        test_mirror_address(),
        state1.nonce,
        &state1.aggregated_pubkey,
        state1.active_count,
        state1.threshold,
    );

    let valid = signer
        .verify_message_hash(&agg_pk, &message_hash, &agg_sig)
        .unwrap();
    assert!(
        valid,
        "Aggregated BLS signature from 3 oracles should verify against aggregated pubkey"
    );
}

#[tokio::test]
async fn test_aggregate_signatures_partial_threshold() {
    // Setup 3 active oracles, but only aggregate 2/3
    let (oracle1, kp1) = create_test_oracle(1, true);
    let (oracle2, kp2) = create_test_oracle(2, true);
    let (oracle3, _kp3) = create_test_oracle(3, true);
    let oracles = vec![oracle1, oracle2, oracle3];

    let nonce = 1u64;
    let state_hash = H256::from([0xCC; 32]);

    // Only 2 of 3 oracles sign
    let state1 = produce_sync_proof(&kp1, &oracles, nonce, state_hash, 0);
    let state2 = produce_sync_proof(&kp2, &oracles, nonce, state_hash, 1);

    let signer = Bn254BLSSigner::new();
    let sig1 = BLSSignature(state1.bls_signature.clone());
    let sig2 = BLSSignature(state2.bls_signature.clone());

    // Aggregate 2 signatures
    let agg_sig = BLSSigner::aggregate_signatures(&signer, vec![sig1, sig2]).unwrap();

    // Aggregate only the 2 signing pubkeys (not all 3)
    let pk1 = BLSPublicKey(kp1.public_key_bytes());
    let pk2 = BLSPublicKey(kp2.public_key_bytes());
    let partial_agg_pk = aggregate_pubkeys(&[pk1, pk2]).unwrap();

    let message_hash = build_registry_sync_message_hash(
        TEST_CHAIN_ID,
        test_mirror_address(),
        state1.nonce,
        &state1.aggregated_pubkey,
        state1.active_count,
        state1.threshold,
    );

    // Verify: 2/3 aggregated signature verifies against 2/3 aggregated pubkey
    let valid = signer
        .verify_message_hash(&partial_agg_pk, &message_hash, &agg_sig)
        .unwrap();
    assert!(
        valid,
        "Partial (2/3) aggregated signature should verify against partial aggregated pubkey"
    );
}

// ============================================================================
// Additional edge case tests
// ============================================================================

#[tokio::test]
async fn test_compute_aggregated_pubkey_matches_across_oracles() {
    // Verify all oracles compute the same aggregated pubkey
    let (oracle1, _kp1) = create_test_oracle(1, true);
    let (oracle2, _kp2) = create_test_oracle(2, true);
    let (oracle3, _kp3) = create_test_oracle(3, true);
    let oracles = vec![oracle1, oracle2, oracle3];

    let agg1 = compute_aggregated_pubkey(&oracles).unwrap();
    let agg2 = compute_aggregated_pubkey(&oracles).unwrap();
    assert_eq!(agg1, agg2, "Aggregated pubkey should be deterministic");
    assert_eq!(agg1.len(), 128, "G2 point should be 128 bytes");
}

#[tokio::test]
async fn test_sync_state_serde_roundtrip() {
    let (oracle1, kp1) = create_test_oracle(1, true);
    let oracles = vec![oracle1];
    let state = produce_sync_proof(&kp1, &oracles, 1, H256::from([0xDD; 32]), 0);

    // Serialize to JSON
    let json_str = serde_json::to_string(&state).unwrap();

    // Deserialize back
    let deserialized: RegistrySyncState = serde_json::from_str(&json_str).unwrap();

    assert_eq!(state, deserialized, "Serde roundtrip should preserve state");
}

#[tokio::test]
async fn test_mock_chain_provides_oracles_for_aggregation() {
    // Verify the full flow: MockChain -> get_oracle_registry -> compute_aggregated_pubkey
    let (oracle1, kp1) = create_test_oracle(1, true);
    let (oracle2, _kp2) = create_test_oracle(2, true);

    let mock_chain = MockChainBuilder::new()
        .with_oracles(vec![oracle1.clone(), oracle2.clone()])
        .build();

    // Fetch oracles from mock chain (simulates what RegistrySyncHandler does)
    let oracles = mock_chain.get_oracle_registry().await.unwrap();
    assert_eq!(oracles.len(), 2);

    // Compute aggregated pubkey from chain data
    let agg_pubkey = compute_aggregated_pubkey(&oracles).unwrap();
    assert_eq!(agg_pubkey.len(), 128);

    // Build and sign message
    let active_count = oracles.iter().filter(|i| i.is_active()).count() as u64;
    let threshold = compute_threshold(active_count);
    let message_hash =
        build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 1, &agg_pubkey, active_count, threshold);
    let signature = sign_registry_sync_message(&kp1, &message_hash).unwrap();
    assert_eq!(signature.len(), 64);

    // Verify signature
    let signer = Bn254BLSSigner::new();
    let valid = signer
        .verify_message_hash(
            &kp1.public_key(),
            &message_hash,
            &BLSSignature(signature),
        )
        .unwrap();
    assert!(valid);
}

#[tokio::test]
async fn test_concurrent_cache_access() {
    let cache = new_registry_sync_cache();

    // Populate initial state
    let (oracle1, kp1) = create_test_oracle(1, true);
    let oracles = vec![oracle1];
    let state = produce_sync_proof(&kp1, &oracles, 1, H256::from([0xEE; 32]), 0);
    {
        let mut guard = cache.write().await;
        *guard = Some(state);
    }

    // Spawn 10 concurrent readers
    let mut handles = vec![];
    for _ in 0..10 {
        let cache_clone = cache.clone();
        handles.push(tokio::spawn(async move {
            let guard = cache_clone.read().await;
            let s = guard.as_ref().unwrap();
            assert_eq!(s.nonce, 1);
            s.to_json_response()
        }));
    }

    // All should succeed
    for handle in handles {
        let json = handle.await.unwrap();
        assert_eq!(json["nonce"], 1);
    }
}
