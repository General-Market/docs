//! P2P transport and heartbeat builders
//!
//! TCP P2P is always used in production. MockP2P is available in common/src/mocks/
//! for integration tests only.

use super::{BootstrapError, BootstrapParams, ChainComponents, P2PComponents};
use crate::p2p::{OnChainPeerDiscovery, PeerDiscovery, StaticPeerDiscovery, TcpP2PTransport};
use common::traits::P2PTransport;
use crate::{HeartbeatMetrics, HeartbeatMonitor, IssuerConfig, PeerHealthTracker};
use common::types::PeerInfo;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Builder for P2P-related components
pub struct P2PBuilder<'a> {
    config: &'a IssuerConfig,
    params: &'a BootstrapParams,
    node_id: u32,
    peer_id: &'a [u8; 32],
    chain: &'a ChainComponents,
}

impl<'a> P2PBuilder<'a> {
    pub fn new(
        config: &'a IssuerConfig,
        params: &'a BootstrapParams,
        node_id: u32,
        peer_id: &'a [u8; 32],
        chain: &'a ChainComponents,
    ) -> Self {
        Self {
            config,
            params,
            node_id,
            peer_id,
            chain,
        }
    }

    pub async fn build(self) -> Result<P2PComponents, BootstrapError> {
        let port = self.config.effective_port();

        // Always use TCP P2P transport (Story 7.12: MockP2P removed from runtime)
        let transport = self.build_tcp_transport(port).await?;

        info!(self.node_id, "TCP P2P transport initialized");

        // Build heartbeat components
        let heartbeat_metrics = Arc::new(HeartbeatMetrics::new());
        let heartbeat_tracker = Arc::new(RwLock::new(PeerHealthTracker::new()));
        let heartbeat_monitor = self.build_heartbeat_monitor(&transport, &heartbeat_tracker, &heartbeat_metrics);

        // Health port is always P2P port + 1000
        let health_port = port + 1000;

        Ok(P2PComponents {
            transport,
            heartbeat_monitor,
            heartbeat_metrics,
            heartbeat_tracker,
            health_port,
        })
    }

    async fn build_tcp_transport(&self, port: u16) -> Result<Option<Arc<TcpP2PTransport>>, BootstrapError> {
        info!(self.node_id, tls = !self.params.no_tls, "Initializing TCP P2P transport");

        // TLS config
        let tls_config = if self.params.no_tls {
            warn!(self.node_id, "TLS disabled for P2P - use only in development!");
            None
        } else {
            warn!(self.node_id, "TLS certificates not configured, running without TLS");
            None
        };

        let transport = TcpP2PTransport::new(*self.peer_id, port, tls_config);

        // Start listener
        transport.start_listener().await.map_err(|e| {
            BootstrapError::P2P(format!("Failed to start P2P listener: {}", e))
        })?;
        info!(self.node_id, port, "P2P listener started");

        // Connect to peers
        let peers = self.discover_peers().await;
        if !peers.is_empty() {
            info!(self.node_id, peer_count = peers.len(), "Connecting to peers");
            if let Err(e) = transport.connect_peers(peers).await {
                warn!(code = "INFRA-007", self.node_id, error = %e, "Failed to connect to some peers");
            }
        }

        Ok(Some(Arc::new(transport)))
    }

    async fn discover_peers(&self) -> Vec<PeerInfo> {
        // Priority: CLI flags > on-chain discovery
        if !self.config.peers.is_empty() {
            return self.parse_static_peers().await;
        }

        // Try on-chain discovery
        let our_address = self.chain.writer.as_ref().map(|cw| cw.address());
        let onchain_discovery = OnChainPeerDiscovery::new(
            self.chain.reader.clone(),
            *self.peer_id,
            our_address,
        );

        info!(self.node_id, our_address = ?our_address, "Attempting on-chain peer discovery");

        match onchain_discovery.discover_peers().await {
            Ok(peers) if !peers.is_empty() => {
                info!(self.node_id, count = peers.len(), "Discovered peers from IssuerRegistry");
                peers
            }
            Ok(_) => {
                info!(self.node_id, "No peers found in IssuerRegistry, standalone mode");
                vec![]
            }
            Err(e) => {
                warn!(error = %e, "On-chain peer discovery failed, standalone mode");
                vec![]
            }
        }
    }

    async fn parse_static_peers(&self) -> Vec<PeerInfo> {
        let peer_infos: Vec<PeerInfo> = self
            .config
            .peers
            .iter()
            .filter_map(|s| {
                let parts: Vec<&str> = s.split(':').collect();
                if parts.len() == 2 {
                    let ip = parts[0].to_string();
                    let port = parts[1].parse::<u16>().ok()?;
                    Some(PeerInfo {
                        peer_id: [0u8; 32],
                        ip,
                        port,
                    })
                } else {
                    warn!(peer = s, "Invalid peer address format, expected ip:port");
                    None
                }
            })
            .collect();

        let discovery = StaticPeerDiscovery::new(peer_infos);
        discovery.discover_peers().await.unwrap_or_else(|e| {
            warn!(error = %e, "Peer discovery failed");
            vec![]
        })
    }

    fn build_heartbeat_monitor(
        &self,
        transport: &Option<Arc<TcpP2PTransport>>,
        tracker: &Arc<RwLock<PeerHealthTracker>>,
        metrics: &Arc<HeartbeatMetrics>,
    ) -> Option<Arc<HeartbeatMonitor<TcpP2PTransport>>> {
        let p2p = transport.as_ref()?;

        let monitor = HeartbeatMonitor::new(
            *self.peer_id,
            p2p.clone(),
            tracker.clone(),
            metrics.clone(),
        );

        info!(self.node_id, "HeartbeatMonitor initialized (1s heartbeat, 5s unhealthy, 3-miss kick)");
        Some(Arc::new(monitor))
    }
}
