//! Leader election implementation for Index L3 Issuer Node
//!
//! Implements deterministic leader election using the formula:
//! `leader_index = keccak256(last_bls_signature) mod num_issuers`
//!
//! This ensures all issuers compute the same leader from the same inputs.

use common::types::BLSSignature;
use ethers::core::utils::keccak256;
use ethers::types::U256;
use thiserror::Error;
use tracing::{debug, info};

/// Errors that can occur during leader election
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum LeaderElectorError {
    #[error("Number of issuers cannot be zero")]
    ZeroIssuers,
}

/// Compute the leader index from a BLS signature and issuer count.
///
/// # Formula
/// `leader_index = keccak256(signature_bytes) mod num_issuers`
///
/// # Arguments
/// * `last_bls_signature` - The aggregated BLS signature from the previous cycle
/// * `num_issuers` - Total number of active issuers in the network
///
/// # Returns
/// * `Ok(u8)` - The index of the elected leader (0 to num_issuers-1)
/// * `Err(LeaderElectorError::ZeroIssuers)` - If num_issuers is 0
///
/// # Determinism
/// This function is deterministic: the same inputs always produce the same output.
/// All issuers in the network will compute the same leader index.
pub fn elect_leader(last_bls_signature: &BLSSignature, num_issuers: u8) -> Result<u8, LeaderElectorError> {
    // Edge case: no issuers
    if num_issuers == 0 {
        return Err(LeaderElectorError::ZeroIssuers);
    }

    // Edge case: single issuer always leads
    if num_issuers == 1 {
        return Ok(0);
    }

    // Hash the signature bytes using keccak256
    let hash = keccak256(&last_bls_signature.0);

    // Interpret hash as big-endian U256
    let hash_value = U256::from_big_endian(&hash);

    // Compute leader index: hash mod num_issuers
    let leader_index = (hash_value % U256::from(num_issuers)).as_u64() as u8;

    debug!(
        signature_len = last_bls_signature.0.len(),
        num_issuers,
        leader_index,
        "Leader elected"
    );

    Ok(leader_index)
}

/// LeaderElector maintains state for leader election within a node.
///
/// Each issuer node creates one LeaderElector instance that tracks:
/// - The node's own ID (to determine if this node is the leader)
/// - The current number of active issuers
/// - The last computed leader index (for logging/debugging)
///
/// # Membership Changes
/// When issuers are added or removed, use the appropriate methods:
/// - `on_issuer_added()` - Increments count, no reindexing needed
/// - `on_issuer_removed(removed_index)` - Decrements count and reindexes if needed
///
/// The issuer registry is responsible for calling these methods and ensuring
/// consistent state across all nodes.
#[derive(Debug, Clone)]
pub struct LeaderElector {
    /// This node's index in the issuer set (0 to num_issuers-1)
    node_id: u8,
    /// Total number of active issuers
    num_issuers: u8,
    /// Last computed leader index (for debugging/observability)
    last_leader_index: Option<u8>,
}

impl LeaderElector {
    /// Create a new LeaderElector for this node.
    ///
    /// # Arguments
    /// * `node_id` - This node's index (0 to num_issuers-1)
    /// * `num_issuers` - Total number of active issuers
    ///
    /// # Panics
    /// Panics if node_id >= num_issuers (invalid configuration)
    pub fn new(node_id: u8, num_issuers: u8) -> Self {
        assert!(
            num_issuers > 0,
            "num_issuers must be > 0"
        );
        assert!(
            node_id < num_issuers,
            "node_id ({}) must be < num_issuers ({})",
            node_id,
            num_issuers
        );

        Self {
            node_id,
            num_issuers,
            last_leader_index: None,
        }
    }

    /// Check if this node is the leader for the given signature (non-mutating).
    ///
    /// This is a read-only check that does not update the cached leader index.
    /// Use `am_i_leader` if you want to update the cache for observability.
    ///
    /// # Arguments
    /// * `last_bls_signature` - The aggregated BLS signature from the previous cycle
    ///
    /// # Returns
    /// `true` if this node is the elected leader, `false` otherwise
    pub fn is_leader(&self, last_bls_signature: &BLSSignature) -> bool {
        match elect_leader(last_bls_signature, self.num_issuers) {
            Ok(leader_index) => {
                let is_leader = leader_index == self.node_id;
                if is_leader {
                    debug!(node_id = self.node_id, "This node is the leader");
                }
                is_leader
            }
            Err(e) => {
                tracing::error!(code = "INFRA-007", error = %e, "Leader election failed");
                false
            }
        }
    }

    /// Check if this node is the leader for the given signature (with caching).
    ///
    /// Updates the internal `last_leader_index` cache for observability.
    /// Use `is_leader` for a non-mutating check.
    ///
    /// # Arguments
    /// * `last_bls_signature` - The aggregated BLS signature from the previous cycle
    ///
    /// # Returns
    /// `true` if this node is the elected leader, `false` otherwise
    pub fn am_i_leader(&mut self, last_bls_signature: &BLSSignature) -> bool {
        match self.get_leader_index(last_bls_signature) {
            Ok(leader_index) => {
                let is_leader = leader_index == self.node_id;
                if is_leader {
                    debug!(node_id = self.node_id, "This node is the leader");
                }
                is_leader
            }
            Err(e) => {
                // This shouldn't happen if LeaderElector is properly constructed
                tracing::error!(code = "INFRA-007", error = %e, "Leader election failed");
                false
            }
        }
    }

    /// Check if this node is the leader for a given cycle number.
    ///
    /// Uses deterministic rotation: `cycle_number % num_issuers == node_id`.
    /// This is independent of shared state (no signature needed), ensuring
    /// all nodes always agree on the leader without needing to propagate
    /// aggregated signatures from leader to followers.
    pub fn is_leader_for_cycle(&mut self, cycle_number: u64) -> bool {
        let leader_index = (cycle_number % self.num_issuers as u64) as u8;
        self.last_leader_index = Some(leader_index);
        let is_leader = leader_index == self.node_id;
        if is_leader {
            debug!(node_id = self.node_id, cycle_number, "This node is the cycle leader");
        }
        is_leader
    }

    /// Get the leader index for the given signature.
    ///
    /// # Arguments
    /// * `last_bls_signature` - The aggregated BLS signature from the previous cycle
    ///
    /// # Returns
    /// The index of the elected leader (0 to num_issuers-1)
    pub fn get_leader_index(&mut self, last_bls_signature: &BLSSignature) -> Result<u8, LeaderElectorError> {
        let leader_index = elect_leader(last_bls_signature, self.num_issuers)?;
        self.last_leader_index = Some(leader_index);
        Ok(leader_index)
    }

    /// Update the issuer count for dynamic membership changes.
    ///
    /// # Arguments
    /// * `new_count` - The new number of active issuers
    ///
    /// # Note
    /// If this node's ID is now >= new_count, this represents a configuration error
    /// (this node has been removed from the issuer set).
    pub fn update_issuer_count(&mut self, new_count: u8) {
        info!(
            old_count = self.num_issuers,
            new_count,
            "Issuer count updated"
        );
        self.num_issuers = new_count;
    }

    /// Handle an issuer being added to the network.
    ///
    /// Increments the issuer count. Leader re-election happens automatically
    /// at the next cycle boundary using the new count.
    ///
    /// # Note
    /// Membership changes take effect at the next cycle boundary.
    pub fn on_issuer_added(&mut self) {
        let new_count = self.num_issuers.saturating_add(1);
        info!(
            old_count = self.num_issuers,
            new_count,
            "Issuer added, count updated"
        );
        self.num_issuers = new_count;
    }

    /// Handle an issuer being removed from the network.
    ///
    /// Decrements the issuer count and reindexes this node if needed.
    /// Leader re-election happens automatically at the next cycle boundary.
    ///
    /// # Arguments
    /// * `removed_index` - The index of the removed issuer
    ///
    /// # Reindexing
    /// If `removed_index < self.node_id`, this node's index shifts down by 1.
    /// If `removed_index == self.node_id`, this node has been removed (caller should handle).
    ///
    /// # Note
    /// Membership changes take effect at the next cycle boundary.
    pub fn on_issuer_removed(&mut self, removed_index: u8) {
        let old_node_id = self.node_id;
        let new_count = self.num_issuers.saturating_sub(1);

        // Reindex if a lower-indexed issuer was removed
        if removed_index < self.node_id && self.node_id > 0 {
            self.node_id = self.node_id.saturating_sub(1);
            info!(
                old_count = self.num_issuers,
                new_count,
                removed_index,
                old_node_id,
                new_node_id = self.node_id,
                "Issuer removed, this node reindexed"
            );
        } else {
            info!(
                old_count = self.num_issuers,
                new_count,
                removed_index,
                "Issuer removed, count updated"
            );
        }

        self.num_issuers = new_count;
    }

    /// Explicitly update this node's ID (for external registry synchronization).
    ///
    /// # Arguments
    /// * `new_node_id` - The new node ID for this issuer
    ///
    /// # Panics
    /// Panics if `new_node_id >= num_issuers`
    pub fn update_node_id(&mut self, new_node_id: u8) {
        assert!(
            new_node_id < self.num_issuers,
            "new_node_id ({}) must be < num_issuers ({})",
            new_node_id,
            self.num_issuers
        );
        info!(
            old_node_id = self.node_id,
            new_node_id,
            "Node ID updated"
        );
        self.node_id = new_node_id;
    }

    /// Get the last computed leader index (for observability).
    pub fn last_leader_index(&self) -> Option<u8> {
        self.last_leader_index
    }

    /// Get this node's ID.
    pub fn node_id(&self) -> u8 {
        self.node_id
    }

    /// Get the current issuer count.
    pub fn num_issuers(&self) -> u8 {
        self.num_issuers
    }
}

/// Tracks leader state across cycles for observability.
///
/// Stores the current cycle's leader information for logging and metrics.
/// Can compute leader elections internally when given a signature.
#[derive(Debug, Clone)]
pub struct CycleLeaderState {
    /// Current cycle number
    cycle_number: u64,
    /// Elected leader index for this cycle
    leader_index: u8,
    /// The signature used for election (for verification/debugging)
    last_signature: BLSSignature,
    /// Number of issuers for election calculation
    num_issuers: u8,
}

impl CycleLeaderState {
    /// Create initial state (genesis case).
    ///
    /// For the first cycle, use a well-known default signature (all zeros)
    /// and leader 0. Default issuer count is 20 (production).
    pub fn genesis() -> Self {
        Self::genesis_with_issuers(20)
    }

    /// Create initial state with custom issuer count.
    ///
    /// For the first cycle, use a well-known default signature (all zeros)
    /// and leader 0.
    pub fn genesis_with_issuers(num_issuers: u8) -> Self {
        Self {
            cycle_number: 0,
            leader_index: 0,
            last_signature: BLSSignature(vec![0u8; 64]),
            num_issuers,
        }
    }

    /// Update state for a new cycle, computing the leader from the signature.
    ///
    /// # Arguments
    /// * `cycle_number` - The new cycle number
    /// * `last_signature` - The BLS signature that determines the leader
    ///
    /// # Returns
    /// The computed leader index, or error if election fails
    pub fn update_cycle(&mut self, cycle_number: u64, last_signature: BLSSignature) -> Result<u8, LeaderElectorError> {
        let leader_index = elect_leader(&last_signature, self.num_issuers)?;
        self.update_cycle_with_leader(cycle_number, last_signature, leader_index);
        Ok(leader_index)
    }

    /// Update state for a new cycle with a pre-computed leader index.
    ///
    /// Use this when the leader has already been computed by a LeaderElector.
    ///
    /// # Arguments
    /// * `cycle_number` - The new cycle number
    /// * `last_signature` - The BLS signature that determines the leader
    /// * `leader_index` - The pre-computed leader index
    pub fn update_cycle_with_leader(&mut self, cycle_number: u64, last_signature: BLSSignature, leader_index: u8) {
        let previous_leader = self.leader_index;
        self.cycle_number = cycle_number;
        self.last_signature = last_signature;
        self.leader_index = leader_index;

        if previous_leader != leader_index {
            info!(
                cycle = cycle_number,
                previous_leader,
                new_leader = leader_index,
                "Leader rotation"
            );
        } else {
            debug!(
                cycle = cycle_number,
                leader = leader_index,
                "Leader unchanged"
            );
        }
    }

    /// Update the issuer count for membership changes.
    pub fn update_issuer_count(&mut self, num_issuers: u8) {
        self.num_issuers = num_issuers;
    }

    /// Get the current leader index.
    pub fn get_current_leader(&self) -> u8 {
        self.leader_index
    }

    /// Get the current cycle number.
    pub fn cycle_number(&self) -> u64 {
        self.cycle_number
    }

    /// Get the last signature used for election.
    pub fn last_signature(&self) -> &BLSSignature {
        &self.last_signature
    }

    /// Get the number of issuers.
    pub fn num_issuers(&self) -> u8 {
        self.num_issuers
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to create a signature from bytes
    fn sig(bytes: &[u8]) -> BLSSignature {
        let mut data = vec![0u8; 64];
        for (i, b) in bytes.iter().enumerate() {
            if i < 64 {
                data[i] = *b;
            }
        }
        BLSSignature(data)
    }

    // ========== elect_leader tests ==========

    #[test]
    fn test_elect_leader_deterministic() {
        // Same signature, same issuer count = same leader
        let signature = sig(&[1, 2, 3, 4, 5]);
        let result1 = elect_leader(&signature, 20).unwrap();
        let result2 = elect_leader(&signature, 20).unwrap();
        assert_eq!(result1, result2, "Election must be deterministic");
    }

    #[test]
    fn test_elect_leader_zero_issuers() {
        let signature = sig(&[1, 2, 3]);
        let result = elect_leader(&signature, 0);
        assert_eq!(result, Err(LeaderElectorError::ZeroIssuers));
    }

    #[test]
    fn test_elect_leader_single_issuer() {
        let signature = sig(&[1, 2, 3]);
        let result = elect_leader(&signature, 1).unwrap();
        assert_eq!(result, 0, "Single issuer is always leader");
    }

    #[test]
    fn test_elect_leader_returns_valid_index() {
        let signature = sig(&[42, 42, 42]);
        for num_issuers in 2..=20 {
            let result = elect_leader(&signature, num_issuers).unwrap();
            assert!(result < num_issuers, "Leader index {} >= num_issuers {}", result, num_issuers);
        }
    }

    #[test]
    fn test_elect_leader_different_signatures_different_leaders() {
        // Statistical test: different signatures should produce different leaders
        // (not guaranteed, but highly likely over many samples)
        let mut leaders = std::collections::HashSet::new();
        for i in 0u8..100 {
            let signature = sig(&[i, i + 1, i + 2, i + 3]);
            let leader = elect_leader(&signature, 20).unwrap();
            leaders.insert(leader);
        }
        // With 100 samples and 20 possible leaders, we should see multiple different values
        assert!(leaders.len() > 5, "Should see varied leaders, got only {}", leaders.len());
    }

    #[test]
    fn test_elect_leader_fair_distribution() {
        // Run 10,000 elections with different signatures, verify roughly uniform distribution
        let mut counts = [0u32; 20];
        for i in 0u32..10_000 {
            let bytes = i.to_le_bytes();
            let signature = sig(&bytes);
            let leader = elect_leader(&signature, 20).unwrap() as usize;
            counts[leader] += 1;
        }

        // Each issuer should get roughly 500 elections (10000/20)
        // Allow 30% variance: 350-650
        for (idx, count) in counts.iter().enumerate() {
            assert!(
                *count >= 350 && *count <= 650,
                "Issuer {} got {} elections, expected ~500 (±30%)",
                idx,
                count
            );
        }
    }

    // ========== LeaderElector tests ==========

    #[test]
    fn test_leader_elector_new() {
        let elector = LeaderElector::new(5, 20);
        assert_eq!(elector.node_id(), 5);
        assert_eq!(elector.num_issuers(), 20);
        assert_eq!(elector.last_leader_index(), None);
    }

    #[test]
    #[should_panic(expected = "num_issuers must be > 0")]
    fn test_leader_elector_zero_issuers_panics() {
        LeaderElector::new(0, 0);
    }

    #[test]
    #[should_panic(expected = "node_id (5) must be < num_issuers (3)")]
    fn test_leader_elector_invalid_node_id_panics() {
        LeaderElector::new(5, 3);
    }

    #[test]
    fn test_am_i_leader_true() {
        // Find a signature that makes node 5 the leader with 20 issuers
        for i in 0u8..=255 {
            let signature = sig(&[i, 0, 0, 0]);
            let leader = elect_leader(&signature, 20).unwrap();
            if leader == 5 {
                let mut elector = LeaderElector::new(5, 20);
                assert!(elector.am_i_leader(&signature), "Node 5 should be leader for this signature");
                return;
            }
        }
        panic!("Could not find a signature that elects node 5");
    }

    #[test]
    fn test_am_i_leader_false() {
        // Find a signature that does NOT make node 5 the leader
        let signature = sig(&[1, 2, 3, 4]);
        let leader = elect_leader(&signature, 20).unwrap();
        if leader != 5 {
            let mut elector = LeaderElector::new(5, 20);
            assert!(!elector.am_i_leader(&signature));
        } else {
            // Try another signature
            let signature2 = sig(&[10, 20, 30, 40]);
            let leader2 = elect_leader(&signature2, 20).unwrap();
            assert_ne!(leader2, 5, "Both test signatures elected node 5, test needs adjustment");
            let mut elector = LeaderElector::new(5, 20);
            assert!(!elector.am_i_leader(&signature2));
        }
    }

    #[test]
    fn test_update_issuer_count() {
        let mut elector = LeaderElector::new(5, 20);
        assert_eq!(elector.num_issuers(), 20);

        elector.update_issuer_count(19);
        assert_eq!(elector.num_issuers(), 19);

        elector.update_issuer_count(20);
        assert_eq!(elector.num_issuers(), 20);
    }

    #[test]
    fn test_all_issuers_compute_same_leader() {
        // Simulate 3 different issuer nodes computing the leader
        let signature = sig(&[99, 88, 77, 66]);

        let mut elector0 = LeaderElector::new(0, 3);
        let mut elector1 = LeaderElector::new(1, 3);
        let mut elector2 = LeaderElector::new(2, 3);

        let leader0 = elector0.get_leader_index(&signature).unwrap();
        let leader1 = elector1.get_leader_index(&signature).unwrap();
        let leader2 = elector2.get_leader_index(&signature).unwrap();

        assert_eq!(leader0, leader1);
        assert_eq!(leader1, leader2);
    }

    #[test]
    fn test_minimum_3_issuers() {
        // Per architecture: minimum 3 issuers to operate
        let signature = sig(&[1, 2, 3]);
        let result = elect_leader(&signature, 3).unwrap();
        assert!(result < 3);
    }

    // ========== CycleLeaderState tests ==========

    #[test]
    fn test_cycle_leader_state_genesis() {
        let state = CycleLeaderState::genesis();
        assert_eq!(state.cycle_number(), 0);
        assert_eq!(state.get_current_leader(), 0);
        assert_eq!(state.last_signature().0.len(), 64);
        assert_eq!(state.num_issuers(), 20);
    }

    #[test]
    fn test_cycle_leader_state_genesis_with_issuers() {
        let state = CycleLeaderState::genesis_with_issuers(10);
        assert_eq!(state.num_issuers(), 10);
        assert_eq!(state.get_current_leader(), 0);
    }

    #[test]
    fn test_cycle_leader_state_update() {
        let mut state = CycleLeaderState::genesis_with_issuers(20);
        let new_sig = sig(&[5, 6, 7, 8]);

        // update_cycle now computes leader internally
        let leader = state.update_cycle(42, new_sig.clone()).unwrap();

        assert_eq!(state.cycle_number(), 42);
        assert_eq!(state.get_current_leader(), leader);
        assert!(leader < 20);
        assert_eq!(state.last_signature().0, new_sig.0);
    }

    #[test]
    fn test_cycle_leader_state_update_with_leader() {
        let mut state = CycleLeaderState::genesis();
        let new_sig = sig(&[5, 6, 7, 8]);

        // Can still set leader explicitly
        state.update_cycle_with_leader(42, new_sig.clone(), 7);

        assert_eq!(state.cycle_number(), 42);
        assert_eq!(state.get_current_leader(), 7);
        assert_eq!(state.last_signature().0, new_sig.0);
    }

    // ========== Membership change tests ==========

    #[test]
    fn test_on_issuer_added() {
        let mut elector = LeaderElector::new(5, 19);
        assert_eq!(elector.num_issuers(), 19);

        elector.on_issuer_added();
        assert_eq!(elector.num_issuers(), 20);
    }

    #[test]
    fn test_on_issuer_removed() {
        let mut elector = LeaderElector::new(5, 20);
        assert_eq!(elector.num_issuers(), 20);

        // Remove issuer at higher index - no reindexing needed
        elector.on_issuer_removed(10);
        assert_eq!(elector.num_issuers(), 19);
        assert_eq!(elector.node_id(), 5); // Unchanged
    }

    #[test]
    fn test_on_issuer_removed_with_reindex() {
        // When lower-indexed issuer is removed, this node's index shifts down
        let mut elector = LeaderElector::new(5, 20);
        assert_eq!(elector.node_id(), 5);

        // Remove issuer at index 2 (lower than our index 5)
        elector.on_issuer_removed(2);
        assert_eq!(elector.num_issuers(), 19);
        assert_eq!(elector.node_id(), 4); // Shifted down by 1
    }

    #[test]
    fn test_on_issuer_removed_same_index() {
        // When this exact issuer is removed, index stays same but state is now invalid
        // Caller is responsible for handling this case
        let mut elector = LeaderElector::new(5, 20);

        elector.on_issuer_removed(5);
        assert_eq!(elector.num_issuers(), 19);
        assert_eq!(elector.node_id(), 5); // Not shifted (removed_index not < node_id)
    }

    #[test]
    fn test_update_node_id() {
        let mut elector = LeaderElector::new(5, 20);
        assert_eq!(elector.node_id(), 5);

        elector.update_node_id(10);
        assert_eq!(elector.node_id(), 10);
    }

    #[test]
    #[should_panic(expected = "new_node_id (25) must be < num_issuers (20)")]
    fn test_update_node_id_invalid() {
        let mut elector = LeaderElector::new(5, 20);
        elector.update_node_id(25); // Panics
    }

    #[test]
    fn test_issuer_count_changes_20_to_19_to_20() {
        // Per AC #5: Handles issuer removal (recalculates with new count)
        let mut elector = LeaderElector::new(5, 20);
        let signature = sig(&[42, 42, 42, 42]);

        // Get leader with 20 issuers
        let leader_with_20 = elector.get_leader_index(&signature).unwrap();
        assert!(leader_with_20 < 20);

        // Remove an issuer at higher index (no reindexing)
        elector.on_issuer_removed(10);
        let leader_with_19 = elector.get_leader_index(&signature).unwrap();
        assert!(leader_with_19 < 19);

        // Add an issuer back
        elector.on_issuer_added();
        let leader_with_20_again = elector.get_leader_index(&signature).unwrap();
        assert!(leader_with_20_again < 20);

        // Same issuer count should give same result
        assert_eq!(leader_with_20, leader_with_20_again);
    }

    #[test]
    fn test_on_issuer_added_saturating() {
        // Edge case: prevent overflow at max u8
        let mut elector = LeaderElector::new(5, 254);
        elector.on_issuer_added();
        assert_eq!(elector.num_issuers(), 255);
        elector.on_issuer_added();
        assert_eq!(elector.num_issuers(), 255); // Saturates at 255
    }

    #[test]
    fn test_on_issuer_removed_saturating() {
        // Edge case: prevent underflow - count can go to 0
        // Note: 0 issuers is an invalid state, but saturating_sub prevents underflow
        let mut elector = LeaderElector::new(0, 1);
        elector.on_issuer_removed(0);
        assert_eq!(elector.num_issuers(), 0); // Saturates at 0
    }

    #[test]
    fn test_is_leader_non_mutating() {
        // is_leader is a non-mutating check (doesn't update cache)
        let elector = LeaderElector::new(5, 20);

        // Find a signature that makes node 5 the leader
        for i in 0u8..=255 {
            let signature = sig(&[i, 0, 0, 0]);
            let leader = elect_leader(&signature, 20).unwrap();
            if leader == 5 {
                // Can call is_leader on a shared reference
                assert!(elector.is_leader(&signature));
                // Cache was not updated (since is_leader is non-mutating)
                assert_eq!(elector.last_leader_index(), None);
                return;
            }
        }
        panic!("Could not find a signature that elects node 5");
    }

    // ========== Real BLS signature tests ==========

    #[test]
    fn test_with_real_bls_signatures() {
        use common::bls::{BLSKeyPair, Bn254BLSSigner};
        use common::traits::BLSSigner;

        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        // Sign a test message to get a real BLS signature
        let message = b"test cycle batch for leader election";
        let signature = signer
            .sign_with_keypair(&keypair, message)
            .expect("signing should succeed");

        // Verify signature is 64 bytes (G1 point)
        assert_eq!(signature.0.len(), 64, "BLS signature should be 64 bytes");

        // Use real signature for leader election
        let leader = elect_leader(&signature, 20).unwrap();
        assert!(leader < 20, "Leader index must be < num_issuers");

        // Election is deterministic - same signature always gives same result
        let leader_again = elect_leader(&signature, 20).unwrap();
        assert_eq!(leader, leader_again, "Election must be deterministic");
    }

    #[test]
    fn test_different_bls_signatures_produce_different_leaders() {
        use common::bls::{BLSKeyPair, Bn254BLSSigner};
        use common::traits::BLSSigner;

        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        // Generate 50 different signatures
        let mut leaders = std::collections::HashSet::new();
        for i in 0..50 {
            let message = format!("message {}", i);
            let signature = signer
                .sign_with_keypair(&keypair, message.as_bytes())
                .expect("signing should succeed");
            let leader = elect_leader(&signature, 20).unwrap();
            leaders.insert(leader);
        }

        // With 50 different signatures and 20 issuers, we should see multiple leaders
        assert!(leaders.len() > 5, "Should see varied leaders, got only {}", leaders.len());
    }
}
