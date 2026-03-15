//! Peer discovery mechanisms for P2P transport
//!
//! Provides different strategies for discovering peer issuers:
//! - `StaticPeerDiscovery` - Read from config file (dev mode)
//! - `OnChainPeerDiscovery` - Read from IssuerRegistry contract (production)

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use ethers::types::Address;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use common::error::Error;
use common::traits::ChainReader;
use common::types::PeerInfo;

/// Trait for peer discovery mechanisms
#[async_trait]
pub trait PeerDiscovery: Send + Sync {
    /// Discover available peers
    ///
    /// Returns a list of peer information for all known issuers.
    async fn discover_peers(&self) -> Result<Vec<PeerInfo>, Error>;

    /// Get the refresh interval for periodic discovery
    fn refresh_interval(&self) -> Duration {
        Duration::from_secs(60) // Default: 60 seconds
    }
}

/// Static peer discovery from configuration
///
/// Used for local development where peers are known in advance.
pub struct StaticPeerDiscovery {
    /// List of configured peers
    peers: Vec<PeerInfo>,
}

impl StaticPeerDiscovery {
    /// Create a new static peer discovery with the given peers
    pub fn new(peers: Vec<PeerInfo>) -> Self {
        Self { peers }
    }

    /// Add a peer to the list
    pub fn add_peer(&mut self, peer: PeerInfo) {
        if !self.peers.iter().any(|p| p.peer_id == peer.peer_id) {
            self.peers.push(peer);
        }
    }

    /// Remove a peer from the list
    pub fn remove_peer(&mut self, peer_id: &[u8; 32]) {
        self.peers.retain(|p| &p.peer_id != peer_id);
    }
}

#[async_trait]
impl PeerDiscovery for StaticPeerDiscovery {
    async fn discover_peers(&self) -> Result<Vec<PeerInfo>, Error> {
        debug!(count = self.peers.len(), "Returning static peer list");
        Ok(self.peers.clone())
    }

    fn refresh_interval(&self) -> Duration {
        // Static peers don't need frequent refresh
        Duration::from_secs(300) // 5 minutes
    }
}

/// On-chain peer discovery from IssuerRegistry contract
///
/// Reads active issuers from the blockchain and extracts their P2P connection info.
/// The `ip` field in the IssuerRegistry is a `bytes32` that stores a UTF-8 string
/// of the form `"ip:port"` (e.g., `"127.0.0.1:9000"`), left-aligned and zero-padded.
pub struct OnChainPeerDiscovery<R: ?Sized> {
    /// Chain reader for querying the IssuerRegistry contract
    chain_reader: Arc<R>,
    /// Cache of discovered peers
    cached_peers: Arc<RwLock<Vec<PeerInfo>>>,
    /// Our own peer ID (to exclude from discovery)
    our_peer_id: [u8; 32],
    /// Our own Ethereum address (to exclude ourselves from on-chain results)
    our_address: Option<Address>,
}

impl<R: ChainReader + ?Sized + 'static> OnChainPeerDiscovery<R> {
    /// Create a new on-chain peer discovery
    pub fn new(chain_reader: Arc<R>, our_peer_id: [u8; 32], our_address: Option<Address>) -> Self {
        Self {
            chain_reader,
            cached_peers: Arc::new(RwLock::new(Vec::new())),
            our_peer_id,
            our_address,
        }
    }

    /// Update the cached peer list
    async fn update_cache(&self, peers: Vec<PeerInfo>) {
        let mut cache = self.cached_peers.write().await;
        *cache = peers;
    }

    /// Get cached peers (for fast access between refreshes)
    pub async fn get_cached_peers(&self) -> Vec<PeerInfo> {
        self.cached_peers.read().await.clone()
    }
}

#[async_trait]
impl<R: ChainReader + ?Sized + 'static> PeerDiscovery for OnChainPeerDiscovery<R> {
    async fn discover_peers(&self) -> Result<Vec<PeerInfo>, Error> {
        // Query IssuerRegistry for all active issuers
        let issuers = match self.chain_reader.get_issuer_registry().await {
            Ok(issuers) => issuers,
            Err(e) => {
                warn!(error = %e, "On-chain peer discovery failed, returning cached peers");
                return Ok(self.get_cached_peers().await);
            }
        };

        let mut peers = Vec::new();
        for issuer in &issuers {
            // Skip ourselves by address
            if let Some(our_addr) = self.our_address {
                if issuer.addr == our_addr {
                    debug!(addr = ?issuer.addr, "Skipping own address in discovery");
                    continue;
                }
            }

            // Parse ip:port from the bytes32 ip field
            let ip_str = issuer.ip_string();
            if ip_str.is_empty() {
                warn!(addr = ?issuer.addr, "Issuer has empty IP field, skipping");
                continue;
            }

            let parts: Vec<&str> = ip_str.split(':').collect();
            if parts.len() != 2 {
                warn!(addr = ?issuer.addr, ip = %ip_str, "Invalid IP:port format in IssuerRegistry, skipping");
                continue;
            }

            let ip = parts[0].to_string();
            let port = match parts[1].parse::<u16>() {
                Ok(p) => p,
                Err(_) => {
                    warn!(addr = ?issuer.addr, ip = %ip_str, "Invalid port in IssuerRegistry, skipping");
                    continue;
                }
            };

            // peer_id will be discovered during handshake
            peers.push(PeerInfo {
                peer_id: [0u8; 32],
                ip,
                port,
            });
        }

        // Filter by peer_id as well (for any peers already known)
        let filtered: Vec<_> = peers
            .into_iter()
            .filter(|p| p.peer_id == [0u8; 32] || p.peer_id != self.our_peer_id)
            .collect();

        info!(count = filtered.len(), total_issuers = issuers.len(), "On-chain peer discovery complete");

        // Update cache for fast access between refreshes
        self.update_cache(filtered.clone()).await;

        Ok(filtered)
    }
}

/// Periodic peer discovery runner
///
/// Runs peer discovery at regular intervals and notifies when peers change.
pub struct PeerDiscoveryRunner<D: PeerDiscovery> {
    /// The discovery mechanism
    discovery: Arc<D>,
    /// Current known peers
    current_peers: Arc<RwLock<Vec<PeerInfo>>>,
    /// Shutdown flag
    shutdown: Arc<RwLock<bool>>,
}

impl<D: PeerDiscovery + 'static> PeerDiscoveryRunner<D> {
    /// Create a new discovery runner
    pub fn new(discovery: D) -> Self {
        Self {
            discovery: Arc::new(discovery),
            current_peers: Arc::new(RwLock::new(Vec::new())),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Get current known peers
    pub async fn get_peers(&self) -> Vec<PeerInfo> {
        self.current_peers.read().await.clone()
    }

    /// Run the discovery loop
    ///
    /// Returns when shutdown is requested.
    pub async fn run(&self) {
        let interval = self.discovery.refresh_interval();
        info!(?interval, "Starting peer discovery loop");

        loop {
            // Check shutdown
            if *self.shutdown.read().await {
                info!("Peer discovery shutdown requested");
                break;
            }

            // Discover peers
            match self.discovery.discover_peers().await {
                Ok(peers) => {
                    let mut current = self.current_peers.write().await;
                    let old_count = current.len();
                    *current = peers;
                    let new_count = current.len();

                    if old_count != new_count {
                        info!(
                            old_count,
                            new_count, "Peer count changed after discovery"
                        );
                    } else {
                        debug!(count = new_count, "Peer discovery complete");
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Peer discovery failed");
                }
            }

            // Wait for next interval
            tokio::time::sleep(interval).await;
        }
    }

    /// Request shutdown
    pub async fn shutdown(&self) {
        *self.shutdown.write().await = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_peer_info(n: u8) -> PeerInfo {
        let mut peer_id = [0u8; 32];
        peer_id[0] = n;
        PeerInfo {
            peer_id,
            ip: format!("127.0.0.{}", n),
            port: 9000 + n as u16,
        }
    }

    #[tokio::test]
    async fn test_static_discovery() {
        let peers = vec![test_peer_info(1), test_peer_info(2), test_peer_info(3)];

        let discovery = StaticPeerDiscovery::new(peers.clone());

        let discovered = discovery.discover_peers().await.unwrap();
        assert_eq!(discovered.len(), 3);
        assert_eq!(discovered[0].peer_id[0], 1);
        assert_eq!(discovered[1].peer_id[0], 2);
        assert_eq!(discovered[2].peer_id[0], 3);
    }

    #[tokio::test]
    async fn test_static_discovery_add_remove() {
        let mut discovery = StaticPeerDiscovery::new(vec![test_peer_info(1)]);

        // Add peer
        discovery.add_peer(test_peer_info(2));
        let discovered = discovery.discover_peers().await.unwrap();
        assert_eq!(discovered.len(), 2);

        // Remove peer
        let peer_id_1 = test_peer_info(1).peer_id;
        discovery.remove_peer(&peer_id_1);
        let discovered = discovery.discover_peers().await.unwrap();
        assert_eq!(discovered.len(), 1);
        assert_eq!(discovered[0].peer_id[0], 2);
    }

    #[tokio::test]
    async fn test_static_discovery_no_duplicates() {
        let mut discovery = StaticPeerDiscovery::new(vec![test_peer_info(1)]);

        // Try to add same peer twice
        discovery.add_peer(test_peer_info(1));
        discovery.add_peer(test_peer_info(1));

        let discovered = discovery.discover_peers().await.unwrap();
        assert_eq!(discovered.len(), 1);
    }

    #[tokio::test]
    async fn test_discovery_runner_get_peers() {
        let peers = vec![test_peer_info(1), test_peer_info(2)];
        let discovery = StaticPeerDiscovery::new(peers);
        let runner = PeerDiscoveryRunner::new(discovery);

        // Initially empty
        let initial = runner.get_peers().await;
        assert!(initial.is_empty());

        // After first discovery (manual trigger for test)
        {
            let discovered = runner.discovery.discover_peers().await.unwrap();
            let mut current = runner.current_peers.write().await;
            *current = discovered;
        }

        let after = runner.get_peers().await;
        assert_eq!(after.len(), 2);
    }
}
