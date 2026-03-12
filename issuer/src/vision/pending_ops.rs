//! Thread-safe queue for pending vision operations.
//!
//! Shared between the deposit watcher (producer) and consensus task (consumer).
//! Operations are enqueued by the watcher and drained by the consensus loop,
//! which batches them into BLS-signed messages for on-chain execution.

use ethers::types::{Address, H256, U256};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESULT_TTL_SECS: u64 = 60;
const IN_PROGRESS_TTL_SECS: u64 = 600;

// ---------------------------------------------------------------------------
// VisionOp
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub enum VisionOp {
    CreditBalance {
        order_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
    },
    CompleteDeposit {
        order_id: u64,
        message_hash: H256,
    },
    RefundDeposit {
        order_id: u64,
        message_hash: H256,
    },
    CompleteWithdraw {
        withdraw_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
    },
}

impl VisionOp {
    /// Returns a (type_tag, id) key for deduplication and result lookup.
    pub fn key(&self) -> (&'static str, u64) {
        match self {
            VisionOp::CreditBalance { order_id, .. } => ("credit", *order_id),
            VisionOp::CompleteDeposit { order_id, .. } => ("complete", *order_id),
            VisionOp::RefundDeposit { order_id, .. } => ("refund", *order_id),
            VisionOp::CompleteWithdraw { withdraw_id, .. } => ("withdraw", *withdraw_id),
        }
    }

    pub fn message_hash(&self) -> &H256 {
        match self {
            VisionOp::CreditBalance { message_hash, .. }
            | VisionOp::CompleteDeposit { message_hash, .. }
            | VisionOp::RefundDeposit { message_hash, .. }
            | VisionOp::CompleteWithdraw { message_hash, .. } => message_hash,
        }
    }

    pub fn id(&self) -> u64 {
        match self {
            VisionOp::CreditBalance { order_id, .. } => *order_id,
            VisionOp::CompleteDeposit { order_id, .. } => *order_id,
            VisionOp::RefundDeposit { order_id, .. } => *order_id,
            VisionOp::CompleteWithdraw { withdraw_id, .. } => *withdraw_id,
        }
    }

    /// Lower value = higher priority when draining.
    pub fn sort_priority(&self) -> u8 {
        match self {
            VisionOp::CreditBalance { .. } => 0,
            VisionOp::CompleteDeposit { .. } => 1,
            VisionOp::RefundDeposit { .. } => 2,
            VisionOp::CompleteWithdraw { .. } => 3,
        }
    }

    pub fn is_credit(&self) -> bool {
        matches!(self, VisionOp::CreditBalance { .. })
    }

    pub fn is_refund(&self) -> bool {
        matches!(self, VisionOp::RefundDeposit { .. })
    }
}

// ---------------------------------------------------------------------------
// OpStatus / OpResult
// ---------------------------------------------------------------------------

enum OpStatus {
    Queued,
    InProgress { since: Instant },
}

#[derive(Clone, Debug)]
pub enum OpResult {
    Success { tx_hash: H256 },
    Permanent { reason: String },
    Failed { error: String },
    Pending,
}

// ---------------------------------------------------------------------------
// Internal entries
// ---------------------------------------------------------------------------

struct PendingEntry {
    op: VisionOp,
    status: OpStatus,
}

struct ResultEntry {
    result: OpResult,
    created_at: Instant,
}

// ---------------------------------------------------------------------------
// PendingOpsQueue
// ---------------------------------------------------------------------------

pub struct PendingOpsQueue {
    pending: Mutex<Vec<PendingEntry>>,
    results: Mutex<HashMap<(&'static str, u64), ResultEntry>>,
}

impl PendingOpsQueue {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(Vec::new()),
            results: Mutex::new(HashMap::new()),
        }
    }

    /// Enqueue an operation unless the same (type, id) is already queued,
    /// in-progress, or has a pending result. Prunes stale in-progress entries.
    pub fn enqueue(&self, op: VisionOp) {
        let key = op.key();

        // Check results first — skip if a pending result exists.
        {
            let results = self.results.lock().unwrap();
            if let Some(entry) = results.get(&key) {
                if entry.created_at.elapsed().as_secs() < RESULT_TTL_SECS {
                    return;
                }
            }
        }

        let mut pending = self.pending.lock().unwrap();

        // Prune stale InProgress entries.
        pending.retain(|e| {
            if let OpStatus::InProgress { since } = &e.status {
                since.elapsed().as_secs() < IN_PROGRESS_TTL_SECS
            } else {
                true
            }
        });

        // Skip if already present (Queued or InProgress).
        let already_exists = pending.iter().any(|e| e.op.key() == key);
        if already_exists {
            return;
        }

        pending.push(PendingEntry {
            op,
            status: OpStatus::Queued,
        });
    }

    /// Drain up to `max` queued operations, transitioning them to InProgress.
    ///
    /// Applies mutual exclusion: if both CreditBalance and RefundDeposit exist
    /// for the same order_id, the RefundDeposit is dropped (credit wins).
    /// Results are sorted by priority (CreditBalance first).
    pub fn drain_pending(&self, max: usize) -> Vec<VisionOp> {
        let mut pending = self.pending.lock().unwrap();

        // Collect order_ids that have a CreditBalance queued.
        let credit_order_ids: Vec<u64> = pending
            .iter()
            .filter(|e| matches!(e.status, OpStatus::Queued) && e.op.is_credit())
            .map(|e| e.op.id())
            .collect();

        // Remove RefundDeposit entries whose order_id conflicts with a CreditBalance.
        pending.retain(|e| {
            if e.op.is_refund() && matches!(e.status, OpStatus::Queued) {
                !credit_order_ids.contains(&e.op.id())
            } else {
                true
            }
        });

        // Collect indices of Queued entries, sorted by priority.
        let mut queued_indices: Vec<usize> = pending
            .iter()
            .enumerate()
            .filter(|(_, e)| matches!(e.status, OpStatus::Queued))
            .map(|(i, _)| i)
            .collect();

        queued_indices.sort_by_key(|&i| pending[i].op.sort_priority());
        queued_indices.truncate(max);

        let now = Instant::now();
        let mut drained = Vec::with_capacity(queued_indices.len());

        for &idx in &queued_indices {
            pending[idx].status = OpStatus::InProgress { since: now };
            drained.push(pending[idx].op.clone());
        }

        drained
    }

    /// Cancel a pending operation by (type_tag, id).
    pub fn cancel_pending(&self, type_tag: &'static str, id: u64) {
        let mut pending = self.pending.lock().unwrap();
        pending.retain(|e| e.op.key() != (type_tag, id));
    }

    /// Record the result for an operation. Removes it from the pending queue.
    pub fn write_result(&self, type_tag: &'static str, id: u64, result: OpResult) {
        {
            let mut pending = self.pending.lock().unwrap();
            pending.retain(|e| e.op.key() != (type_tag, id));
        }
        {
            let mut results = self.results.lock().unwrap();
            results.insert(
                (type_tag, id),
                ResultEntry {
                    result,
                    created_at: Instant::now(),
                },
            );
        }
    }

    /// Poll the result for an operation. Prunes expired results.
    pub fn poll_result(&self, type_tag: &'static str, id: u64) -> Option<OpResult> {
        let mut results = self.results.lock().unwrap();

        // Prune expired entries.
        results.retain(|_, entry| entry.created_at.elapsed().as_secs() < RESULT_TTL_SECS);

        results.get(&(type_tag, id)).map(|e| e.result.clone())
    }

    /// Remove a result entry.
    pub fn clear_result(&self, type_tag: &'static str, id: u64) {
        let mut results = self.results.lock().unwrap();
        results.remove(&(type_tag, id));
    }

    /// Returns true if there is at least one Queued operation.
    pub fn has_queued(&self) -> bool {
        let pending = self.pending.lock().unwrap();
        pending.iter().any(|e| matches!(e.status, OpStatus::Queued))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{Address, H256, U256};

    fn credit_op(order_id: u64) -> VisionOp {
        VisionOp::CreditBalance {
            order_id,
            user: Address::zero(),
            amount: U256::from(1000u64),
            message_hash: H256::from_low_u64_be(order_id),
        }
    }

    fn complete_op(order_id: u64) -> VisionOp {
        VisionOp::CompleteDeposit {
            order_id,
            message_hash: H256::from_low_u64_be(order_id),
        }
    }

    fn refund_op(order_id: u64) -> VisionOp {
        VisionOp::RefundDeposit {
            order_id,
            message_hash: H256::from_low_u64_be(order_id),
        }
    }

    #[test]
    fn test_enqueue_dedup() {
        let q = PendingOpsQueue::new();
        q.enqueue(credit_op(1));
        q.enqueue(credit_op(1)); // duplicate — should be skipped

        let ops = q.drain_pending(10);
        assert_eq!(ops.len(), 1, "duplicate enqueue should be skipped");
    }

    #[test]
    fn test_drain_bounded() {
        let q = PendingOpsQueue::new();
        for i in 0..10 {
            q.enqueue(credit_op(i));
        }

        let ops = q.drain_pending(5);
        assert_eq!(ops.len(), 5, "drain should return at most max");

        // Remaining 5 should still be queued.
        let ops2 = q.drain_pending(10);
        assert_eq!(ops2.len(), 5, "remaining ops should be drainable");
    }

    #[test]
    fn test_mutual_exclusion_credit_vs_refund() {
        let q = PendingOpsQueue::new();
        q.enqueue(refund_op(42));
        q.enqueue(credit_op(42));

        let ops = q.drain_pending(10);
        assert_eq!(ops.len(), 1, "mutual exclusion: only one should remain");
        assert!(ops[0].is_credit(), "credit should win over refund");
    }

    #[test]
    fn test_result_lifecycle() {
        let q = PendingOpsQueue::new();
        q.enqueue(credit_op(7));

        let ops = q.drain_pending(10);
        assert_eq!(ops.len(), 1);

        // No result yet.
        assert!(q.poll_result("credit", 7).is_none());

        // Write result.
        let tx = H256::from_low_u64_be(999);
        q.write_result("credit", 7, OpResult::Success { tx_hash: tx });

        // Poll returns result.
        let res = q.poll_result("credit", 7);
        assert!(res.is_some());
        match res.unwrap() {
            OpResult::Success { tx_hash } => assert_eq!(tx_hash, tx),
            _ => panic!("expected Success"),
        }

        // Clear removes it.
        q.clear_result("credit", 7);
        assert!(q.poll_result("credit", 7).is_none());
    }

    #[test]
    fn test_cancel_pending() {
        let q = PendingOpsQueue::new();
        q.enqueue(credit_op(5));
        q.enqueue(credit_op(6));

        q.cancel_pending("credit", 5);

        let ops = q.drain_pending(10);
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].id(), 6);
    }

    #[test]
    fn test_credit_first_ordering() {
        let q = PendingOpsQueue::new();
        // Enqueue in reverse priority order.
        q.enqueue(complete_op(2));
        q.enqueue(credit_op(1));
        q.enqueue(complete_op(3));

        let ops = q.drain_pending(10);
        assert_eq!(ops.len(), 3);
        assert!(
            ops[0].is_credit(),
            "CreditBalance should be drained first"
        );
        assert_eq!(ops[0].sort_priority(), 0);
        assert_eq!(ops[1].sort_priority(), 1);
        assert_eq!(ops[2].sort_priority(), 1);
    }
}
