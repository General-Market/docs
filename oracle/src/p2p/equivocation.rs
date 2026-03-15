//! P2P-level equivocation detection.
//!
//! Tracks the first content hash seen from each peer per (cycle, phase_ordinal).
//! If a second, *different* hash arrives for the same key the peer is equivocating
//! (Byzantine behaviour).
//!
//! This module operates at the transport layer using raw `u8` phase ordinals so it
//! remains independent of consensus-layer types.

use dashmap::DashMap;

use common::types::PeerId;

/// Key: (peer_id, cycle_number, phase_ordinal)
type DetectorKey = (PeerId, u64, u8);

/// Tracks the first message content hash seen from each peer per
/// (cycle_number, phase_ordinal). If a second, *different* hash arrives for
/// the same key, an equivocation is flagged.
pub struct EquivocationDetector {
    /// Key: (peer_id, cycle_number, phase_ordinal)
    /// Value: SHA-256 hash of first message content
    seen: DashMap<DetectorKey, [u8; 32]>,
}

impl EquivocationDetector {
    pub fn new() -> Self {
        Self {
            seen: DashMap::new(),
        }
    }

    /// Returns `true` if equivocation detected (different content for same key).
    ///
    /// On first call for a given (peer, cycle, phase_ordinal) the hash is recorded
    /// and `false` is returned. Subsequent calls with the *same* hash return `false`.
    /// A call with a *different* hash returns `true` -- the peer equivocated.
    pub fn check(
        &self,
        peer: &PeerId,
        cycle: u64,
        phase_ordinal: u8,
        content_hash: [u8; 32],
    ) -> bool {
        let key = (*peer, cycle, phase_ordinal);
        match self.seen.entry(key) {
            dashmap::mapref::entry::Entry::Vacant(e) => {
                e.insert(content_hash);
                false
            }
            dashmap::mapref::entry::Entry::Occupied(e) => *e.get() != content_hash,
        }
    }

    /// Cleanup entries from old cycles. Retains the current cycle and
    /// up to 2 prior cycles to handle in-flight messages.
    pub fn gc(&self, current_cycle: u64) {
        self.seen
            .retain(|&(_, cycle, _), _| cycle >= current_cycle.saturating_sub(2));
    }

    /// Size-based GC: if entries exceed `max_entries`, drop the oldest
    /// cycle entirely.
    pub fn gc_by_size(&self, max_entries: usize) {
        if self.seen.len() > max_entries {
            let min_cycle = self.seen.iter().map(|r| r.key().1).min().unwrap_or(0);
            self.seen.retain(|&(_, cycle, _), _| cycle > min_cycle);
        }
    }

    /// Number of tracked entries (for observability).
    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.seen.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_check_returns_false() {
        let det = EquivocationDetector::new();
        let peer = [1u8; 32];
        assert!(!det.check(&peer, 10, 2, [0xAA; 32]));
    }

    #[test]
    fn same_hash_no_equivocation() {
        let det = EquivocationDetector::new();
        let peer = [1u8; 32];
        let hash = [0xAA; 32];
        det.check(&peer, 10, 2, hash);
        assert!(!det.check(&peer, 10, 2, hash));
    }

    #[test]
    fn different_hash_is_equivocation() {
        let det = EquivocationDetector::new();
        let peer = [2u8; 32];
        assert!(!det.check(&peer, 10, 2, [0xAA; 32]));
        assert!(det.check(&peer, 10, 2, [0xBB; 32]));
    }

    #[test]
    fn different_cycles_are_independent() {
        let det = EquivocationDetector::new();
        let peer = [3u8; 32];
        assert!(!det.check(&peer, 10, 2, [0xAA; 32]));
        // Different cycle -> independent, not equivocation
        assert!(!det.check(&peer, 11, 2, [0xBB; 32]));
    }

    #[test]
    fn different_phases_are_independent() {
        let det = EquivocationDetector::new();
        let peer = [4u8; 32];
        assert!(!det.check(&peer, 10, 2, [0xAA; 32]));
        // Different phase -> independent
        assert!(!det.check(&peer, 10, 4, [0xBB; 32]));
    }

    #[test]
    fn gc_removes_old_entries() {
        let det = EquivocationDetector::new();
        let peer = [5u8; 32];
        det.check(&peer, 5, 2, [0xAA; 32]);
        det.check(&peer, 10, 2, [0xBB; 32]);
        assert_eq!(det.len(), 2);

        det.gc(10);
        // cycle 5 < 10-2=8 -> removed
        assert_eq!(det.len(), 1);
    }

    #[test]
    fn gc_by_size_drops_oldest_cycle() {
        let det = EquivocationDetector::new();
        let peer = [6u8; 32];
        det.check(&peer, 1, 2, [0x01; 32]);
        det.check(&peer, 2, 2, [0x02; 32]);
        det.check(&peer, 3, 2, [0x03; 32]);
        assert_eq!(det.len(), 3);

        det.gc_by_size(2);
        assert_eq!(det.len(), 2);
    }

    #[test]
    fn gc_by_size_noop_when_under_limit() {
        let det = EquivocationDetector::new();
        let peer = [7u8; 32];
        det.check(&peer, 1, 2, [0x01; 32]);
        assert_eq!(det.len(), 1);

        det.gc_by_size(10);
        assert_eq!(det.len(), 1);
    }
}
