//! Continuous co-sign aggregator for Vision `createBatch` proposals.
//!
//! The previous design awaited cosigns inside the heartbeat: leader broadcasts,
//! then blocks on `sign_rx.recv()` for a deadline, retries, drops the batch when
//! the future starves. Under runtime contention, cosigns arrived but the awaiting
//! future never woke. Forty-five seconds elapsed. The batch died. Refunds.
//!
//! Eth2's attestation gossip resolves this by removing the leader's deadline
//! entirely. Cosigns accumulate continuously in a shared pool; a separate task
//! submits on-chain the moment quorum is reached. Late attestations still count.
//! Lifetime is bounded by absolute age, not by a per-call timer.
//!
//! This module is the same pattern, narrowed to `createBatch`:
//!   - Leader broadcasts ONCE, calls [`CosignAggregator::register_proposal`].
//!   - Receive-side calls [`CosignAggregator::add_cosign`] for every incoming
//!     `VisionCreateBatchSign`. No timeout, no per-source channel.
//!   - A 1 s submitter loop calls [`CosignAggregator::drain_ready`] and
//!     submits each ready proposal on-chain.
//!   - Entries age out via [`CosignAggregator::prune_stale`].
//!
//! Re-registration replaces a prior entry for the same source — a fresh
//! heartbeat supersedes a stale proposal that never reached quorum.

use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use ethers::types::H256;

use common::BLSSignature;

/// Snapshot of a leader's createBatch proposal plus its growing co-sign set.
///
/// Every field needed to rebuild the `createBatch` calldata lives here, so the
/// submitter task is decoupled from the heartbeat's local variables.
#[derive(Clone)]
pub struct ProposalState {
    pub message_hash: H256,
    pub leader_signature: BLSSignature,
    /// `(signer_index, signature)` pairs — the leader's own signature is the
    /// first entry, followers append as they arrive.
    pub cosigns: Vec<(u8, BLSSignature)>,
    /// OR of `(1 << signer_index)` over `cosigns` — what gets passed on-chain.
    pub signer_bits: u64,
    pub threshold: usize,
    pub created_at: Instant,
    pub submitted: bool,
    pub source_name: String,
    pub source_id: H256,
    pub config_hash: H256,
    pub tick_duration: u64,
    pub lock_offset: u64,
    pub settlement_grace: u64,
    pub ref_nonce: u64,
    pub lifecycle_id: u64,
}

impl ProposalState {
    /// Quorum reached and not yet drained for submission.
    pub fn ready(&self) -> bool {
        !self.submitted && self.cosigns.len() >= self.threshold
    }
}

/// Lock-free per-source proposal store. One entry per `source_id`.
pub struct CosignAggregator {
    proposals: DashMap<H256, ProposalState>,
    max_age: Duration,
}

impl CosignAggregator {
    pub fn new(max_age: Duration) -> Self {
        Self { proposals: DashMap::new(), max_age }
    }

    /// Number of currently tracked proposals (any state).
    pub fn pending_count(&self) -> usize {
        self.proposals.len()
    }

    /// Number of proposals at quorum and not yet submitted.
    pub fn ready_count(&self) -> usize {
        self.proposals.iter().filter(|e| e.value().ready()).count()
    }

    /// Leader registers a freshly broadcast proposal.
    ///
    /// Replaces any prior entry for the same source — a new heartbeat
    /// supersedes a stale proposal. The leader's own signature is included as
    /// the first cosign so quorum can land on the first follower's reply.
    pub fn register_proposal(&self, state: ProposalState) {
        self.proposals.insert(state.source_id, state);
    }

    /// Append a follower cosign. Returns `true` if quorum just became reached.
    ///
    /// - Discards cosigns for a different `message_hash` (stale proposal).
    /// - Discards duplicates by `signer_index`.
    /// - No-op if no proposal is registered for this `source_id`.
    pub fn add_cosign(
        &self,
        source_id: H256,
        message_hash: H256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> bool {
        let mut entry = match self.proposals.get_mut(&source_id) {
            Some(e) => e,
            None => return false,
        };
        let state = entry.value_mut();
        if state.message_hash != message_hash {
            return false;
        }
        if state.cosigns.iter().any(|(idx, _)| *idx == signer_index) {
            return false;
        }
        let was_below = state.cosigns.len() < state.threshold;
        state.signer_bits |= 1u64 << signer_index;
        state.cosigns.push((signer_index, signature));
        was_below && state.cosigns.len() >= state.threshold
    }

    /// Returns proposals at quorum that haven't been submitted yet.
    ///
    /// Marks each returned entry as `submitted = true` so the submitter loop
    /// never double-submits. If the on-chain call fails, the caller may remove
    /// the entry via [`CosignAggregator::forget`] to let the next heartbeat retry.
    pub fn drain_ready(&self) -> Vec<ProposalState> {
        let mut ready = Vec::new();
        for mut entry in self.proposals.iter_mut() {
            let state = entry.value_mut();
            if state.ready() {
                state.submitted = true;
                ready.push(state.clone());
            }
        }
        ready
    }

    /// Remove the entry for a source. Called after a successful on-chain submit
    /// (or to abandon a stale proposal).
    pub fn forget(&self, source_id: &H256) {
        self.proposals.remove(source_id);
    }

    /// Drop entries older than `max_age`. Submitted entries also age out — the
    /// submitter may still need them briefly, but anything past the cap is
    /// unrecoverable.
    pub fn prune_stale(&self) {
        let cutoff = Instant::now().checked_sub(self.max_age);
        if let Some(cutoff) = cutoff {
            self.proposals.retain(|_, state| state.created_at >= cutoff);
        }
    }
}

/// Convenience: an `Arc<CosignAggregator>` is what callers actually share.
pub type SharedCosignAggregator = Arc<CosignAggregator>;
