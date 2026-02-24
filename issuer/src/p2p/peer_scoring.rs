//! Peer scoring and auto-banning
//!
//! Tracks per-peer reputation using lock-free atomics. Misbehaving peers
//! (invalid messages, rate-limit violations, decode failures) accumulate
//! negative scores; well-behaved peers slowly accrue positive score.
//!
//! A background tick (5 s) applies heartbeat penalties for missing peers,
//! bans peers below -50.0, and suspends bans when >33% of peers are
//! unhealthy (partition heuristic).

use dashmap::DashMap;
use std::sync::atomic::{AtomicI64, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use common::types::PeerId;

/// Per-peer reputation state.
///
/// Scores are stored as fixed-point i64 (actual_score * 100) so that
/// fractional adjustments (+0.1) can be represented with atomics.
#[derive(Debug)]
pub struct PeerScore {
    /// Fixed-point score: real_score = score / 100
    pub score: AtomicI64,
    /// Count of invalid (BLS-fail, wrong-cycle, etc.) messages
    pub invalid_messages: AtomicU32,
    /// Count of rate-limit hits from this peer
    pub rate_limit_hits: AtomicU32,
    /// Count of decode (deserialization) failures
    pub decode_failures: AtomicU32,
    /// If set, the peer is banned until this instant
    pub banned_until: Mutex<Option<Instant>>,
    /// How many times this peer has been banned (drives exponential backoff)
    pub ban_count: AtomicU32,
}

/// Lock-free concurrent peer scorer.
///
/// All mutation is via atomics or a short `Mutex` on the ban timestamp,
/// so callers never need to hold an external lock.
pub struct PeerScorer {
    scores: DashMap<PeerId, PeerScore>,
    startup_time: Instant,
}

impl PeerScorer {
    pub fn new() -> Self {
        Self {
            scores: DashMap::new(),
            startup_time: Instant::now(),
        }
    }

    // ── Positive events ──────────────────────────────────────────────

    /// +0.1 score (stored as +10 in fixed-point)
    pub fn record_good_message(&self, peer: &PeerId) {
        self.get_or_create(peer)
            .score
            .fetch_add(10, Ordering::Relaxed);
    }

    // ── Negative events ──────────────────────────────────────────────

    /// -10.0 score (invalid BLS sig, wrong cycle, etc.)
    pub fn record_invalid_message(&self, peer: &PeerId) {
        let entry = self.get_or_create(peer);
        entry.score.fetch_sub(1000, Ordering::Relaxed);
        entry.invalid_messages.fetch_add(1, Ordering::Relaxed);
    }

    /// -2.0 score
    pub fn record_rate_limit_hit(&self, peer: &PeerId) {
        let entry = self.get_or_create(peer);
        entry.score.fetch_sub(200, Ordering::Relaxed);
        entry.rate_limit_hits.fetch_add(1, Ordering::Relaxed);
    }

    /// -1.0 during startup grace period (first 60 s), -5.0 after.
    pub fn record_decode_failure(&self, peer: &PeerId) {
        let entry = self.get_or_create(peer);
        let penalty = if self.startup_time.elapsed().as_secs() < 60 {
            100
        } else {
            500
        };
        entry.score.fetch_sub(penalty, Ordering::Relaxed);
        entry.decode_failures.fetch_add(1, Ordering::Relaxed);
    }

    // ── Queries ──────────────────────────────────────────────────────

    /// Check if a peer is currently banned.
    pub fn is_banned(&self, peer: &PeerId) -> bool {
        if let Some(entry) = self.scores.get(peer) {
            if let Ok(banned_until) = entry.banned_until.lock() {
                if let Some(until) = *banned_until {
                    return Instant::now() < until;
                }
            }
        }
        false
    }

    /// Get the current (real) score for a peer, or 0.0 if unknown.
    pub fn score_of(&self, peer: &PeerId) -> f64 {
        self.scores
            .get(peer)
            .map(|e| e.score.load(Ordering::Relaxed) as f64 / 100.0)
            .unwrap_or(0.0)
    }

    // ── Tick (called every 5 s) ──────────────────────────────────────

    /// Periodic maintenance.  Returns the list of peers that were just banned.
    ///
    /// 1. Applies a -5.0 heartbeat penalty for every tracked peer that is
    ///    **not** in `connected_peers`.
    /// 2. If >33 % of tracked peers are unhealthy (score < 0), assumes a
    ///    network partition and suspends bans entirely.
    /// 3. Otherwise, bans every peer whose score fell below -50.0 with an
    ///    exponentially increasing ban duration (60 s, 120 s, 240 s, ...,
    ///    capped at ~17 h).
    pub fn tick(&self, connected_peers: &[PeerId]) -> Vec<PeerId> {
        let mut to_ban = Vec::new();

        // 1. Heartbeat penalty for peers NOT in connected list
        for entry in self.scores.iter() {
            if !connected_peers.contains(entry.key()) {
                entry.value().score.fetch_sub(500, Ordering::Relaxed); // -5.0
            }
        }

        // 2. Partition heuristic: >33% peers unhealthy -> suspend bans
        let total = self.scores.len();
        let unhealthy = self
            .scores
            .iter()
            .filter(|e| e.value().score.load(Ordering::Relaxed) < 0)
            .count();

        if total >= 3 && unhealthy > total / 3 {
            tracing::error!(
                code = "INFRA-023",
                unhealthy,
                total,
                "POSSIBLE NETWORK PARTITION - >33% peers unhealthy, suspending bans"
            );
            return to_ban; // empty — no bans during partition
        }

        // 3. Ban peers below -50.0 (stored as -5000)
        for entry in self.scores.iter() {
            let score = entry.value().score.load(Ordering::Relaxed);
            if score < -5000 {
                let ban_count = entry.value().ban_count.fetch_add(1, Ordering::Relaxed) + 1;
                // Exponential ban: 60s * 2^(ban_count-1), capped at 2^10 = ~17 h
                let ban_secs = 60u64 * 2u64.pow((ban_count - 1).min(10));
                if let Ok(mut banned) = entry.value().banned_until.lock() {
                    *banned = Some(Instant::now() + std::time::Duration::from_secs(ban_secs));
                }
                to_ban.push(*entry.key());

                let peer_id = entry.key();
                tracing::warn!(
                    code = "INFRA-023",
                    ?peer_id,
                    score,
                    ban_secs,
                    ban_count,
                    "Peer banned"
                );
            }
        }

        to_ban
    }

    // ── Internal ─────────────────────────────────────────────────────

    fn get_or_create(&self, peer: &PeerId) -> dashmap::mapref::one::Ref<'_, PeerId, PeerScore> {
        if !self.scores.contains_key(peer) {
            self.scores.insert(
                *peer,
                PeerScore {
                    score: AtomicI64::new(0),
                    invalid_messages: AtomicU32::new(0),
                    rate_limit_hits: AtomicU32::new(0),
                    decode_failures: AtomicU32::new(0),
                    banned_until: Mutex::new(None),
                    ban_count: AtomicU32::new(0),
                },
            );
        }
        self.scores.get(peer).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_peer(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    #[test]
    fn good_messages_increase_score() {
        let scorer = PeerScorer::new();
        let peer = test_peer(1);

        scorer.record_good_message(&peer);
        scorer.record_good_message(&peer);
        assert!((scorer.score_of(&peer) - 0.2).abs() < f64::EPSILON);
    }

    #[test]
    fn invalid_message_decreases_score() {
        let scorer = PeerScorer::new();
        let peer = test_peer(2);

        scorer.record_invalid_message(&peer);
        assert!((scorer.score_of(&peer) - (-10.0)).abs() < f64::EPSILON);
    }

    #[test]
    fn rate_limit_hit_decreases_score() {
        let scorer = PeerScorer::new();
        let peer = test_peer(3);

        scorer.record_rate_limit_hit(&peer);
        assert!((scorer.score_of(&peer) - (-2.0)).abs() < f64::EPSILON);
    }

    #[test]
    fn ban_triggers_below_threshold() {
        let scorer = PeerScorer::new();
        let peer = test_peer(4);

        // 6 invalid messages = -60.0, well below -50.0 threshold
        for _ in 0..6 {
            scorer.record_invalid_message(&peer);
        }

        let banned = scorer.tick(&[peer]); // peer is "connected"
        assert!(banned.contains(&peer));
        assert!(scorer.is_banned(&peer));
    }

    #[test]
    fn partition_heuristic_suspends_bans() {
        let scorer = PeerScorer::new();
        let peers: Vec<PeerId> = (1..=3).map(test_peer).collect();

        // Make all 3 peers very unhealthy (>33% threshold)
        for p in &peers {
            for _ in 0..6 {
                scorer.record_invalid_message(p);
            }
        }

        let banned = scorer.tick(&peers);
        // All peers are unhealthy => partition heuristic kicks in => no bans
        assert!(banned.is_empty());
    }

    #[test]
    fn not_banned_by_default() {
        let scorer = PeerScorer::new();
        assert!(!scorer.is_banned(&test_peer(99)));
    }

    #[test]
    fn heartbeat_penalty_for_missing_peer() {
        let scorer = PeerScorer::new();
        let peer = test_peer(5);
        scorer.record_good_message(&peer); // create the entry

        // Tick with empty connected list -> peer gets -5.0 heartbeat penalty
        let _ = scorer.tick(&[]);
        assert!((scorer.score_of(&peer) - (-4.9)).abs() < f64::EPSILON);
    }
}
