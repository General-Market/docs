//! Heartbeat monitor coordination
//!
//! Coordinates heartbeat sending, health checking, and kick vote proposals.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::RwLock;
use tokio::time::{interval, interval_at, Instant};
use tracing::{debug, info, trace, warn};

use common::traits::P2PTransport;
use common::types::{P2PMessage, PeerId};

use super::metrics::HeartbeatMetrics;
use super::tracker::PeerHealthTracker;
use super::types::{KickVoteProposal, HEARTBEAT_INTERVAL};

/// Heartbeat monitor for oracle node health tracking
///
/// Manages periodic heartbeat sending and peer health monitoring.
pub struct HeartbeatMonitor<P: P2PTransport + Send + Sync + 'static> {
    /// Our own peer ID
    peer_id: PeerId,
    /// P2P transport for sending heartbeats
    p2p: Arc<P>,
    /// Health tracker for all peers
    tracker: Arc<RwLock<PeerHealthTracker>>,
    /// Metrics for monitoring
    metrics: Arc<HeartbeatMetrics>,
    /// Shutdown signal
    shutdown: Arc<AtomicBool>,
    /// Active kick proposals (for admin review)
    kick_proposals: Arc<RwLock<Vec<KickVoteProposal>>>,
}

impl<P: P2PTransport + Send + Sync + 'static> HeartbeatMonitor<P> {
    /// Create a new heartbeat monitor
    pub fn new(
        peer_id: PeerId,
        p2p: Arc<P>,
        tracker: Arc<RwLock<PeerHealthTracker>>,
        metrics: Arc<HeartbeatMetrics>,
    ) -> Self {
        Self {
            peer_id,
            p2p,
            tracker,
            metrics,
            shutdown: Arc::new(AtomicBool::new(false)),
            kick_proposals: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Start the heartbeat monitor
    ///
    /// Spawns two background tasks:
    /// 1. Heartbeat sender (every 1 second)
    /// 2. Health checker (every 1 second, offset by 500ms)
    pub async fn start(&self) -> (tokio::task::JoinHandle<()>, tokio::task::JoinHandle<()>) {
        let sender_handle = self.spawn_heartbeat_sender();
        let checker_handle = self.spawn_health_checker();

        (sender_handle, checker_handle)
    }

    /// Spawn the heartbeat sender task
    fn spawn_heartbeat_sender(&self) -> tokio::task::JoinHandle<()> {
        let peer_id = self.peer_id;
        let p2p = self.p2p.clone();
        let metrics = self.metrics.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            let mut ticker = interval(HEARTBEAT_INTERVAL);

            loop {
                ticker.tick().await;

                if shutdown.load(Ordering::Relaxed) {
                    debug!("Heartbeat sender shutting down");
                    break;
                }

                // Get current timestamp
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                // Build heartbeat message
                let message = P2PMessage::Heartbeat {
                    sender_id: peer_id,
                    timestamp,
                };

                // Broadcast to all peers
                if let Err(e) = p2p.broadcast(message).await {
                    warn!(error = %e, "Failed to broadcast heartbeat");
                } else {
                    trace!(timestamp, "Heartbeat sent");
                    metrics.increment_heartbeats_sent();
                }
            }
        })
    }

    /// Spawn the health checker task
    fn spawn_health_checker(&self) -> tokio::task::JoinHandle<()> {
        let tracker = self.tracker.clone();
        let metrics = self.metrics.clone();
        let shutdown = self.shutdown.clone();
        let kick_proposals = self.kick_proposals.clone();
        let our_peer_id = self.peer_id;

        tokio::spawn(async move {
            // Offset by 500ms from heartbeat sender
            let start = Instant::now() + Duration::from_millis(500);
            let mut ticker = interval_at(start, HEARTBEAT_INTERVAL);

            loop {
                ticker.tick().await;

                if shutdown.load(Ordering::Relaxed) {
                    debug!("Health checker shutting down");
                    break;
                }

                // Run health check
                let mut tracker_guard = tracker.write().await;
                let unhealthy_peers = tracker_guard.check_health();

                // Update metrics
                let healthy_count = tracker_guard.healthy_count() as u32;
                let unhealthy_count = tracker_guard.unhealthy_count() as u32;
                metrics.update_peer_counts(healthy_count, unhealthy_count);

                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                metrics.update_last_check_time(now_ms);

                // Log unhealthy peers
                for peer_id in &unhealthy_peers {
                    if let Some(info) = tracker_guard.get_peer_health(peer_id) {
                        warn!(
                            ?peer_id,
                            consecutive_misses = info.consecutive_misses,
                            "Peer is unhealthy"
                        );
                    }
                }

                // Check for kick candidates
                let candidates = tracker_guard.get_kick_candidates();
                for candidate_id in candidates {
                    // Safety check: never propose to kick ourselves
                    if candidate_id == our_peer_id {
                        warn!("Self-kick protection: ignoring kick proposal for our own peer ID");
                        continue;
                    }

                    if let Some(proposal) = tracker_guard.create_kick_proposal(&candidate_id) {
                        warn!(
                            target_id = ?proposal.target_id,
                            reason = %proposal.reason,
                            consecutive_misses = proposal.consecutive_misses,
                            "Proposing kick vote (NOT auto-executed, stored for admin review)"
                        );

                        // Store proposal for admin review
                        let mut proposals = kick_proposals.write().await;

                        // Only add if not already proposed for this peer
                        if !proposals.iter().any(|p| p.target_id == candidate_id) {
                            proposals.push(proposal);
                            metrics.increment_kick_votes_proposed();
                        }
                    }
                }

                drop(tracker_guard);

                trace!(healthy = healthy_count, unhealthy = unhealthy_count, "Health check complete");
            }
        })
    }

    /// Handle a received heartbeat message
    ///
    /// Called by the P2P message router when a heartbeat is received.
    pub async fn on_heartbeat_received(&self, peer_id: PeerId, timestamp: u64) {
        trace!(?peer_id, timestamp, "Heartbeat received");

        let mut tracker = self.tracker.write().await;
        tracker.record_heartbeat(peer_id, timestamp);
        drop(tracker);

        self.metrics.increment_heartbeats_received();
    }

    /// Shutdown the heartbeat monitor
    pub fn shutdown(&self) {
        info!("Shutting down heartbeat monitor");
        self.shutdown.store(true, Ordering::Relaxed);
    }

    /// Check if shutdown has been signaled
    pub fn is_shutdown(&self) -> bool {
        self.shutdown.load(Ordering::Relaxed)
    }

    /// Get the metrics for this monitor
    pub fn metrics(&self) -> Arc<HeartbeatMetrics> {
        self.metrics.clone()
    }

    /// Get the tracker for this monitor
    pub fn tracker(&self) -> Arc<RwLock<PeerHealthTracker>> {
        self.tracker.clone()
    }

    /// Get pending kick proposals (for admin review)
    pub async fn get_kick_proposals(&self) -> Vec<KickVoteProposal> {
        self.kick_proposals.read().await.clone()
    }

    /// Clear a kick proposal (after admin has reviewed/acted)
    pub async fn clear_kick_proposal(&self, target_id: &PeerId) {
        let mut proposals = self.kick_proposals.write().await;
        proposals.retain(|p| p.target_id != *target_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use common::error::Error;
    use common::traits::MessageStream;
    use std::sync::Mutex;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    /// Mock P2P transport for testing
    struct MockP2PTransport {
        broadcasts: Arc<Mutex<Vec<P2PMessage>>>,
    }

    impl MockP2PTransport {
        fn new() -> Self {
            Self {
                broadcasts: Arc::new(Mutex::new(Vec::new())),
            }
        }

        fn get_broadcasts(&self) -> Vec<P2PMessage> {
            self.broadcasts.lock().unwrap().clone()
        }
    }

    #[async_trait]
    impl P2PTransport for MockP2PTransport {
        async fn connect_peers(&self, _peers: Vec<common::types::PeerInfo>) -> Result<(), Error> {
            Ok(())
        }

        async fn broadcast(&self, message: P2PMessage) -> Result<(), Error> {
            self.broadcasts.lock().unwrap().push(message);
            Ok(())
        }

        async fn send_to(&self, _peer_id: PeerId, _message: P2PMessage) -> Result<(), Error> {
            Ok(())
        }

        async fn receive(&self) -> Result<MessageStream, Error> {
            // Return empty stream that yields the correct type
            let stream = async_stream::stream! {
                // Never yields, but type inference needs help
                #[allow(unreachable_code)]
                loop {
                    // This will never execute but establishes the type
                    yield Ok(([0u8; 32], P2PMessage::Heartbeat { sender_id: [0u8; 32], timestamp: 0 }));
                    return;
                }
            };
            Ok(Box::pin(stream))
        }
    }

    #[tokio::test]
    async fn test_heartbeat_sender() {
        let peer_id = test_peer_id(1);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(PeerHealthTracker::new()));
        let metrics = Arc::new(HeartbeatMetrics::new());

        let monitor = HeartbeatMonitor::new(peer_id, p2p.clone(), tracker, metrics.clone());

        // Start the monitor
        let (sender_handle, checker_handle) = monitor.start().await;

        // Wait for at least one heartbeat to be sent
        tokio::time::sleep(Duration::from_millis(1100)).await;

        // Shutdown
        monitor.shutdown();
        let _ = tokio::time::timeout(Duration::from_secs(1), sender_handle).await;
        let _ = tokio::time::timeout(Duration::from_secs(1), checker_handle).await;

        // Verify heartbeat was sent
        let broadcasts = p2p.get_broadcasts();
        assert!(!broadcasts.is_empty(), "Expected at least one broadcast");

        // Check metrics
        assert!(metrics.get_heartbeats_sent() >= 1);
    }

    #[tokio::test]
    async fn test_on_heartbeat_received() {
        let our_peer_id = test_peer_id(1);
        let other_peer_id = test_peer_id(2);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(PeerHealthTracker::new()));
        let metrics = Arc::new(HeartbeatMetrics::new());

        let monitor = HeartbeatMonitor::new(our_peer_id, p2p, tracker.clone(), metrics.clone());

        // Receive a heartbeat from another peer
        monitor.on_heartbeat_received(other_peer_id, 12345).await;

        // Verify tracker was updated
        let tracker_guard = tracker.read().await;
        let info = tracker_guard.get_peer_health(&other_peer_id);
        assert!(info.is_some());
        assert_eq!(info.unwrap().last_heartbeat_timestamp, 12345);

        // Verify metrics
        assert_eq!(metrics.get_heartbeats_received(), 1);
    }

    #[tokio::test]
    async fn test_shutdown() {
        let peer_id = test_peer_id(1);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(PeerHealthTracker::new()));
        let metrics = Arc::new(HeartbeatMetrics::new());

        let monitor = HeartbeatMonitor::new(peer_id, p2p, tracker, metrics);

        assert!(!monitor.is_shutdown());

        monitor.shutdown();

        assert!(monitor.is_shutdown());
    }

    #[tokio::test]
    async fn test_metrics_updated_on_health_check() {
        let peer_id = test_peer_id(1);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(PeerHealthTracker::new()));
        let metrics = Arc::new(HeartbeatMetrics::new());

        // Pre-populate tracker with a healthy peer
        {
            let mut t = tracker.write().await;
            t.record_heartbeat(test_peer_id(2), 12345);
        }

        let monitor = HeartbeatMonitor::new(peer_id, p2p, tracker, metrics.clone());

        // Start monitor
        let (sender_handle, checker_handle) = monitor.start().await;

        // Wait for health check to run (starts at 500ms offset)
        tokio::time::sleep(Duration::from_millis(600)).await;

        monitor.shutdown();
        let _ = tokio::time::timeout(Duration::from_secs(1), sender_handle).await;
        let _ = tokio::time::timeout(Duration::from_secs(1), checker_handle).await;

        // Verify metrics were updated
        assert!(metrics.get_last_check_time_ms() > 0);
    }

    #[tokio::test]
    async fn test_kick_proposal_not_auto_executed() {
        let our_peer_id = test_peer_id(1);
        let bad_peer_id = test_peer_id(2);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(
            PeerHealthTracker::with_thresholds(Duration::from_millis(10), 3)
        ));
        let metrics = Arc::new(HeartbeatMetrics::new());

        // Register a peer that will become unhealthy
        {
            let mut t = tracker.write().await;
            t.record_heartbeat(bad_peer_id, 12345);
        }

        let monitor = HeartbeatMonitor::new(our_peer_id, p2p.clone(), tracker.clone(), metrics.clone());

        // Start monitor
        let (sender_handle, checker_handle) = monitor.start().await;

        // Wait for peer to become kick candidate (3 health checks with threshold misses)
        // Health check runs every 1s starting at 500ms offset
        tokio::time::sleep(Duration::from_millis(4000)).await;

        monitor.shutdown();
        let _ = tokio::time::timeout(Duration::from_secs(1), sender_handle).await;
        let _ = tokio::time::timeout(Duration::from_secs(1), checker_handle).await;

        // Verify kick proposal was stored (not broadcast)
        let proposals = monitor.get_kick_proposals().await;

        // P2P broadcasts should only contain heartbeats, no kick votes
        let broadcasts = p2p.get_broadcasts();
        let kick_votes = broadcasts.iter().filter(|m| matches!(m, P2PMessage::KickVote { .. })).count();
        assert_eq!(kick_votes, 0, "Kick votes should NOT be auto-broadcast");

        // If peer became a kick candidate, proposal should be stored
        if !proposals.is_empty() {
            assert_eq!(proposals[0].target_id, bad_peer_id);
            assert!(metrics.get_kick_votes_proposed() >= 1);
        }
    }

    #[tokio::test]
    async fn test_self_kick_protection() {
        // This test verifies we never propose to kick ourselves
        let our_peer_id = test_peer_id(1);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(
            PeerHealthTracker::with_thresholds(Duration::from_millis(1), 1)
        ));
        let metrics = Arc::new(HeartbeatMetrics::new());

        // Register ourselves as a peer that would become unhealthy
        {
            let mut t = tracker.write().await;
            t.record_heartbeat(our_peer_id, 12345);
        }

        let monitor = HeartbeatMonitor::new(our_peer_id, p2p, tracker, metrics);

        // Wait for health checks
        let (sender_handle, checker_handle) = monitor.start().await;
        tokio::time::sleep(Duration::from_millis(2100)).await;

        monitor.shutdown();
        let _ = tokio::time::timeout(Duration::from_secs(1), sender_handle).await;
        let _ = tokio::time::timeout(Duration::from_secs(1), checker_handle).await;

        // Should not have any kick proposals for ourselves
        let proposals = monitor.get_kick_proposals().await;
        assert!(
            proposals.iter().all(|p| p.target_id != our_peer_id),
            "Should never propose to kick ourselves"
        );
    }

    #[tokio::test]
    async fn test_clear_kick_proposal() {
        let our_peer_id = test_peer_id(1);
        let target_peer_id = test_peer_id(2);
        let p2p = Arc::new(MockP2PTransport::new());
        let tracker = Arc::new(RwLock::new(PeerHealthTracker::new()));
        let metrics = Arc::new(HeartbeatMetrics::new());

        let monitor = HeartbeatMonitor::new(our_peer_id, p2p, tracker, metrics);

        // Manually add a kick proposal
        {
            let mut proposals = monitor.kick_proposals.write().await;
            proposals.push(KickVoteProposal::new(
                target_peer_id,
                "Test reason".to_string(),
                3,
            ));
        }

        // Verify it's there
        let proposals = monitor.get_kick_proposals().await;
        assert_eq!(proposals.len(), 1);

        // Clear it
        monitor.clear_kick_proposal(&target_peer_id).await;

        // Verify it's gone
        let proposals = monitor.get_kick_proposals().await;
        assert!(proposals.is_empty());
    }
}
