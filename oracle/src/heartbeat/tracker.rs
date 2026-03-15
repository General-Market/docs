//! Peer health tracking
//!
//! Tracks heartbeat timestamps and health status for all known peers.

use std::collections::HashMap;
use std::time::Duration;

use common::types::PeerId;
use tracing::{debug, trace};

use super::types::{KickVoteProposal, PeerHealthInfo, PeerHealthStatus, KICK_VOTE_THRESHOLD, UNHEALTHY_THRESHOLD};

/// Tracks health status of all known peers
#[derive(Debug)]
pub struct PeerHealthTracker {
    /// Health info for each tracked peer
    peers: HashMap<PeerId, PeerHealthInfo>,
    /// Duration after which a peer is considered unhealthy
    unhealthy_threshold: Duration,
    /// Number of consecutive misses before proposing a kick
    kick_vote_threshold: u32,
}

impl Default for PeerHealthTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl PeerHealthTracker {
    /// Create a new health tracker with default thresholds
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
            unhealthy_threshold: UNHEALTHY_THRESHOLD,
            kick_vote_threshold: KICK_VOTE_THRESHOLD,
        }
    }

    /// Create a health tracker with custom thresholds
    pub fn with_thresholds(unhealthy_threshold: Duration, kick_vote_threshold: u32) -> Self {
        Self {
            peers: HashMap::new(),
            unhealthy_threshold,
            kick_vote_threshold,
        }
    }

    /// Register a new peer to track
    ///
    /// If the peer is already registered, this is a no-op.
    pub fn register_peer(&mut self, peer_id: PeerId) {
        self.peers.entry(peer_id).or_insert_with(|| {
            debug!(?peer_id, "Registering new peer for health tracking");
            PeerHealthInfo::new(peer_id)
        });
    }

    /// Remove a peer from tracking (e.g., after they've been kicked)
    pub fn remove_peer(&mut self, peer_id: &PeerId) {
        if self.peers.remove(peer_id).is_some() {
            debug!(?peer_id, "Removed peer from health tracking");
        }
    }

    /// Record a heartbeat received from a peer
    ///
    /// If the peer is not registered, they will be registered automatically.
    pub fn record_heartbeat(&mut self, peer_id: PeerId, timestamp: u64) {
        let info = self.peers.entry(peer_id).or_insert_with(|| {
            debug!(?peer_id, "Auto-registering peer on heartbeat");
            PeerHealthInfo::new(peer_id)
        });

        trace!(?peer_id, timestamp, "Recording heartbeat");
        info.update_from_heartbeat(timestamp);
    }

    /// Check health of all peers and return list of unhealthy peer IDs
    ///
    /// This should be called periodically (e.g., every second).
    pub fn check_health(&mut self) -> Vec<PeerId> {
        let mut unhealthy = Vec::new();

        for (peer_id, info) in self.peers.iter_mut() {
            if info.check_health(self.unhealthy_threshold) {
                debug!(
                    ?peer_id,
                    consecutive_misses = info.consecutive_misses,
                    "Peer became unhealthy"
                );
            }

            if info.status == PeerHealthStatus::Unhealthy {
                unhealthy.push(*peer_id);
            }
        }

        unhealthy
    }

    /// Get list of healthy peer IDs
    pub fn get_healthy_peers(&self) -> Vec<PeerId> {
        self.peers
            .iter()
            .filter(|(_, info)| info.status == PeerHealthStatus::Healthy)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Get health info for a specific peer
    pub fn get_peer_health(&self, peer_id: &PeerId) -> Option<&PeerHealthInfo> {
        self.peers.get(peer_id)
    }

    /// Get list of peers that should be considered for kick votes
    ///
    /// These are peers with consecutive_misses >= kick_vote_threshold.
    pub fn get_kick_candidates(&self) -> Vec<PeerId> {
        self.peers
            .iter()
            .filter(|(_, info)| info.consecutive_misses >= self.kick_vote_threshold)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Create a kick vote proposal for a peer
    ///
    /// Returns None if the peer is not a kick candidate.
    pub fn create_kick_proposal(&self, peer_id: &PeerId) -> Option<KickVoteProposal> {
        let info = self.peers.get(peer_id)?;

        if info.consecutive_misses >= self.kick_vote_threshold {
            Some(KickVoteProposal::new(
                *peer_id,
                format!(
                    "No heartbeat for {} consecutive health checks",
                    info.consecutive_misses
                ),
                info.consecutive_misses,
            ))
        } else {
            None
        }
    }

    /// Get count of tracked peers
    pub fn peer_count(&self) -> usize {
        self.peers.len()
    }

    /// Get count of healthy peers
    pub fn healthy_count(&self) -> usize {
        self.peers
            .values()
            .filter(|info| info.status == PeerHealthStatus::Healthy)
            .count()
    }

    /// Get count of unhealthy peers
    pub fn unhealthy_count(&self) -> usize {
        self.peers
            .values()
            .filter(|info| info.status == PeerHealthStatus::Unhealthy)
            .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    #[test]
    fn test_register_peer() {
        let mut tracker = PeerHealthTracker::new();
        let peer = test_peer_id(1);

        tracker.register_peer(peer);

        assert_eq!(tracker.peer_count(), 1);
        assert!(tracker.get_peer_health(&peer).is_some());
    }

    #[test]
    fn test_register_peer_idempotent() {
        let mut tracker = PeerHealthTracker::new();
        let peer = test_peer_id(1);

        tracker.register_peer(peer);
        tracker.register_peer(peer);
        tracker.register_peer(peer);

        assert_eq!(tracker.peer_count(), 1);
    }

    #[test]
    fn test_remove_peer() {
        let mut tracker = PeerHealthTracker::new();
        let peer = test_peer_id(1);

        tracker.register_peer(peer);
        assert_eq!(tracker.peer_count(), 1);

        tracker.remove_peer(&peer);
        assert_eq!(tracker.peer_count(), 0);
        assert!(tracker.get_peer_health(&peer).is_none());
    }

    #[test]
    fn test_record_heartbeat_updates_status() {
        let mut tracker = PeerHealthTracker::new();
        let peer = test_peer_id(1);

        tracker.register_peer(peer);
        tracker.record_heartbeat(peer, 12345);

        let info = tracker.get_peer_health(&peer).unwrap();
        assert_eq!(info.status, PeerHealthStatus::Healthy);
        assert_eq!(info.last_heartbeat_timestamp, 12345);
    }

    #[test]
    fn test_record_heartbeat_auto_registers() {
        let mut tracker = PeerHealthTracker::new();
        let peer = test_peer_id(1);

        // Don't register first
        tracker.record_heartbeat(peer, 12345);

        assert_eq!(tracker.peer_count(), 1);
        let info = tracker.get_peer_health(&peer).unwrap();
        assert_eq!(info.status, PeerHealthStatus::Healthy);
    }

    #[test]
    fn test_get_healthy_peers() {
        let mut tracker = PeerHealthTracker::new();
        let peer1 = test_peer_id(1);
        let peer2 = test_peer_id(2);

        tracker.record_heartbeat(peer1, 12345);
        tracker.register_peer(peer2); // Not healthy (no heartbeat yet)

        let healthy = tracker.get_healthy_peers();
        assert_eq!(healthy.len(), 1);
        assert_eq!(healthy[0], peer1);
    }

    #[test]
    fn test_check_health_marks_unhealthy() {
        // Use very short threshold for testing
        let mut tracker = PeerHealthTracker::with_thresholds(
            Duration::from_millis(10),
            KICK_VOTE_THRESHOLD,
        );
        let peer = test_peer_id(1);

        tracker.record_heartbeat(peer, 12345);

        // Should be healthy immediately
        let unhealthy = tracker.check_health();
        assert!(unhealthy.is_empty());
        assert_eq!(tracker.healthy_count(), 1);

        // Wait for threshold to pass
        sleep(Duration::from_millis(20));

        // Should now be unhealthy
        let unhealthy = tracker.check_health();
        assert_eq!(unhealthy.len(), 1);
        assert_eq!(unhealthy[0], peer);
        assert_eq!(tracker.unhealthy_count(), 1);
    }

    #[test]
    fn test_consecutive_misses_increment() {
        let mut tracker = PeerHealthTracker::with_thresholds(
            Duration::from_millis(10),
            KICK_VOTE_THRESHOLD,
        );
        let peer = test_peer_id(1);

        tracker.record_heartbeat(peer, 12345);
        sleep(Duration::from_millis(20));

        // First check - misses = 1
        tracker.check_health();
        let info = tracker.get_peer_health(&peer).unwrap();
        assert_eq!(info.consecutive_misses, 1);

        // Second check - misses = 2
        tracker.check_health();
        let info = tracker.get_peer_health(&peer).unwrap();
        assert_eq!(info.consecutive_misses, 2);

        // Third check - misses = 3 (kick candidate)
        tracker.check_health();
        let info = tracker.get_peer_health(&peer).unwrap();
        assert_eq!(info.consecutive_misses, 3);
    }

    #[test]
    fn test_get_kick_candidates() {
        let mut tracker = PeerHealthTracker::with_thresholds(
            Duration::from_millis(1),
            3,
        );
        let peer1 = test_peer_id(1);
        let peer2 = test_peer_id(2);

        tracker.record_heartbeat(peer1, 12345);
        tracker.record_heartbeat(peer2, 12345);

        // Wait for threshold
        sleep(Duration::from_millis(5));

        // Run health checks to accumulate misses
        tracker.check_health();
        sleep(Duration::from_millis(5));
        tracker.check_health();
        sleep(Duration::from_millis(5));
        tracker.check_health();

        let candidates = tracker.get_kick_candidates();
        assert_eq!(candidates.len(), 2);
    }

    #[test]
    fn test_create_kick_proposal() {
        let mut tracker = PeerHealthTracker::with_thresholds(
            Duration::from_millis(1),
            3,
        );
        let peer = test_peer_id(1);

        tracker.record_heartbeat(peer, 12345);

        // Not a candidate yet
        assert!(tracker.create_kick_proposal(&peer).is_none());

        // Accumulate misses
        sleep(Duration::from_millis(5));
        for _ in 0..3 {
            tracker.check_health();
            sleep(Duration::from_millis(5));
        }

        // Now should be a candidate
        let proposal = tracker.create_kick_proposal(&peer);
        assert!(proposal.is_some());
        let proposal = proposal.unwrap();
        assert_eq!(proposal.target_id, peer);
        assert!(proposal.consecutive_misses >= 3);
    }

    #[test]
    fn test_heartbeat_resets_misses() {
        let mut tracker = PeerHealthTracker::with_thresholds(
            Duration::from_millis(5),
            3,
        );
        let peer = test_peer_id(1);

        tracker.record_heartbeat(peer, 12345);

        // Accumulate some misses
        sleep(Duration::from_millis(10));
        tracker.check_health();
        tracker.check_health();

        let info = tracker.get_peer_health(&peer).unwrap();
        assert!(info.consecutive_misses > 0);

        // Receive heartbeat - should reset
        tracker.record_heartbeat(peer, 12346);

        let info = tracker.get_peer_health(&peer).unwrap();
        assert_eq!(info.consecutive_misses, 0);
        assert_eq!(info.status, PeerHealthStatus::Healthy);
    }

    #[test]
    fn test_healthy_and_unhealthy_counts() {
        let mut tracker = PeerHealthTracker::with_thresholds(
            Duration::from_millis(5),
            3,
        );

        tracker.record_heartbeat(test_peer_id(1), 100);
        tracker.record_heartbeat(test_peer_id(2), 100);
        tracker.register_peer(test_peer_id(3)); // Unknown status

        assert_eq!(tracker.peer_count(), 3);
        assert_eq!(tracker.healthy_count(), 2);
        assert_eq!(tracker.unhealthy_count(), 0);
    }
}
