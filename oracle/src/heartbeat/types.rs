//! Health-related types for heartbeat monitoring
//!
//! Defines the data structures used to track peer health status.

use common::types::PeerId;
use std::time::{Duration, Instant};

/// Heartbeat interval (1 second per architecture)
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_millis(1000);

/// Threshold for marking a peer as unhealthy (5 seconds = 5 missed heartbeats)
pub const UNHEALTHY_THRESHOLD: Duration = Duration::from_millis(5000);

/// Number of consecutive health check misses before proposing a kick vote
pub const KICK_VOTE_THRESHOLD: u32 = 3;

/// Health status of a peer
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PeerHealthStatus {
    /// Peer is responding to heartbeats normally
    Healthy,
    /// Peer has not responded within the threshold
    Unhealthy,
    /// Peer status is not yet known (no heartbeat received)
    Unknown,
}

impl Default for PeerHealthStatus {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Detailed health information for a peer
#[derive(Debug, Clone)]
pub struct PeerHealthInfo {
    /// Peer identifier
    pub peer_id: PeerId,
    /// Last time we received a heartbeat from this peer
    pub last_seen: Option<Instant>,
    /// Current health status
    pub status: PeerHealthStatus,
    /// Number of consecutive health checks where this peer was unhealthy
    pub consecutive_misses: u32,
    /// Timestamp from the last heartbeat message (sender's timestamp)
    pub last_heartbeat_timestamp: u64,
}

impl PeerHealthInfo {
    /// Create new health info for a peer
    pub fn new(peer_id: PeerId) -> Self {
        Self {
            peer_id,
            last_seen: None,
            status: PeerHealthStatus::Unknown,
            consecutive_misses: 0,
            last_heartbeat_timestamp: 0,
        }
    }

    /// Update health info from a received heartbeat
    ///
    /// Resets consecutive misses and marks peer as healthy.
    pub fn update_from_heartbeat(&mut self, timestamp: u64) {
        self.last_seen = Some(Instant::now());
        self.status = PeerHealthStatus::Healthy;
        self.consecutive_misses = 0;
        self.last_heartbeat_timestamp = timestamp;
    }

    /// Check if peer should be marked unhealthy based on the threshold
    ///
    /// Returns true if the peer's status changed to unhealthy.
    pub fn check_health(&mut self, threshold: Duration) -> bool {
        let was_unhealthy = self.status == PeerHealthStatus::Unhealthy;

        match self.last_seen {
            Some(last) if last.elapsed() > threshold => {
                self.status = PeerHealthStatus::Unhealthy;
                self.consecutive_misses += 1;
                !was_unhealthy // Return true only if newly unhealthy
            }
            Some(_) => {
                // Within threshold, mark as healthy
                self.status = PeerHealthStatus::Healthy;
                false
            }
            None => {
                // Never seen - mark as unhealthy but don't increment misses
                // (they haven't had a chance to send a heartbeat yet)
                self.status = PeerHealthStatus::Unknown;
                false
            }
        }
    }

    /// Check if this peer is a candidate for kick vote
    pub fn is_kick_candidate(&self) -> bool {
        self.consecutive_misses >= KICK_VOTE_THRESHOLD
    }
}

/// Proposal to kick a peer from the network
#[derive(Debug, Clone)]
pub struct KickVoteProposal {
    /// The peer to be kicked
    pub target_id: PeerId,
    /// Reason for the kick proposal
    pub reason: String,
    /// Number of consecutive misses that triggered this proposal
    pub consecutive_misses: u32,
    /// When this proposal was created
    pub proposed_at: Instant,
}

impl KickVoteProposal {
    /// Create a new kick vote proposal
    pub fn new(target_id: PeerId, reason: String, consecutive_misses: u32) -> Self {
        Self {
            target_id,
            reason,
            consecutive_misses,
            proposed_at: Instant::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    #[test]
    fn test_peer_health_info_new() {
        let peer_id = test_peer_id(1);
        let info = PeerHealthInfo::new(peer_id);

        assert_eq!(info.peer_id, peer_id);
        assert!(info.last_seen.is_none());
        assert_eq!(info.status, PeerHealthStatus::Unknown);
        assert_eq!(info.consecutive_misses, 0);
        assert_eq!(info.last_heartbeat_timestamp, 0);
    }

    #[test]
    fn test_update_from_heartbeat() {
        let mut info = PeerHealthInfo::new(test_peer_id(1));

        info.update_from_heartbeat(12345);

        assert!(info.last_seen.is_some());
        assert_eq!(info.status, PeerHealthStatus::Healthy);
        assert_eq!(info.consecutive_misses, 0);
        assert_eq!(info.last_heartbeat_timestamp, 12345);
    }

    #[test]
    fn test_check_health_within_threshold() {
        let mut info = PeerHealthInfo::new(test_peer_id(1));
        info.update_from_heartbeat(12345);

        // Check immediately - should be healthy
        let changed = info.check_health(Duration::from_secs(5));

        assert!(!changed);
        assert_eq!(info.status, PeerHealthStatus::Healthy);
        assert_eq!(info.consecutive_misses, 0);
    }

    #[test]
    fn test_check_health_never_seen() {
        let mut info = PeerHealthInfo::new(test_peer_id(1));

        let changed = info.check_health(Duration::from_secs(5));

        assert!(!changed); // No change since we don't mark unknown as changed
        assert_eq!(info.status, PeerHealthStatus::Unknown);
        assert_eq!(info.consecutive_misses, 0); // Don't increment for never-seen
    }

    #[test]
    fn test_is_kick_candidate() {
        let mut info = PeerHealthInfo::new(test_peer_id(1));

        assert!(!info.is_kick_candidate());

        info.consecutive_misses = 2;
        assert!(!info.is_kick_candidate());

        info.consecutive_misses = 3;
        assert!(info.is_kick_candidate());

        info.consecutive_misses = 5;
        assert!(info.is_kick_candidate());
    }

    #[test]
    fn test_kick_vote_proposal_new() {
        let target = test_peer_id(1);
        let proposal = KickVoteProposal::new(target, "No heartbeat".to_string(), 3);

        assert_eq!(proposal.target_id, target);
        assert_eq!(proposal.reason, "No heartbeat");
        assert_eq!(proposal.consecutive_misses, 3);
    }

    #[test]
    fn test_default_peer_health_status() {
        let status: PeerHealthStatus = Default::default();
        assert_eq!(status, PeerHealthStatus::Unknown);
    }
}
