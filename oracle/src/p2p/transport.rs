//! TCP-based P2P transport implementation
//!
//! Provides the production implementation of the P2PTransport trait
//! using TCP connections with optional TLS.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, OnceLock};

use async_trait::async_trait;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

use common::error::Error;
use common::traits::{MessageStream, P2PTransport};
use common::types::{P2PMessage, PeerId, PeerInfo};

use super::connection::{temp_peer_id_from_addr, ConnectionStatus, PeerConnection};
use super::metrics::P2PMetrics;
use super::peer_scoring::PeerScorer;
use super::tls::TlsConfig;

/// Extract the variant name from a P2PMessage for diagnostic logging.
/// Returns a short string like "Heartbeat", "PriceProposal", etc.
fn msg_variant_name(msg: &P2PMessage) -> &'static str {
    match msg {
        P2PMessage::CycleStart { .. } => "CycleStart",
        P2PMessage::PriceProposal { .. } => "PriceProposal",
        P2PMessage::PriceVote { .. } => "PriceVote",
        P2PMessage::BatchProposal { .. } => "BatchProposal",
        P2PMessage::BatchSign { .. } => "BatchSign",
        P2PMessage::Heartbeat { .. } => "Heartbeat",
        P2PMessage::KickVote { .. } => "KickVote",
        P2PMessage::ItpCreationProposal { .. } => "ItpCreationProposal",
        P2PMessage::ItpCreationSign { .. } => "ItpCreationSign",
        P2PMessage::RebalanceRequestProposal { .. } => "RebalanceRequestProposal",
        P2PMessage::RebalanceRequestSign { .. } => "RebalanceRequestSign",
        P2PMessage::BridgeSettlementToL3Proposal { .. } => "BridgeSettlementToL3Proposal",
        P2PMessage::BridgeSettlementToL3Sign { .. } => "BridgeSettlementToL3Sign",
        P2PMessage::SubmitOrderForUserProposal { .. } => "SubmitOrderForUserProposal",
        P2PMessage::SubmitOrderForUserSign { .. } => "SubmitOrderForUserSign",
        P2PMessage::ConfirmBatchProposal { .. } => "ConfirmBatchProposal",
        P2PMessage::ConfirmBatchSign { .. } => "ConfirmBatchSign",
        P2PMessage::ConfirmFillsProposal { .. } => "ConfirmFillsProposal",
        P2PMessage::ConfirmFillsSign { .. } => "ConfirmFillsSign",
        P2PMessage::BridgeL3ToSettlementProposal { .. } => "BridgeL3ToSettlementProposal",
        P2PMessage::BridgeL3ToSettlementSign { .. } => "BridgeL3ToSettlementSign",
        P2PMessage::ReleaseToVaultProposal { .. } => "ReleaseToVaultProposal",
        P2PMessage::ReleaseToVaultSign { .. } => "ReleaseToVaultSign",
        P2PMessage::RebalanceBatchProposal { .. } => "RebalanceBatchProposal",
        P2PMessage::RebalanceBatchSign { .. } => "RebalanceBatchSign",
        P2PMessage::UpdateWeightsProposal { .. } => "UpdateWeightsProposal",
        P2PMessage::UpdateWeightsSign { .. } => "UpdateWeightsSign",
        P2PMessage::RebalanceProposal { .. } => "RebalanceProposal",
        P2PMessage::RebalanceSign { .. } => "RebalanceSign",
        P2PMessage::SubmitSellOrderProposal { .. } => "SubmitSellOrderProposal",
        P2PMessage::SubmitSellOrderSign { .. } => "SubmitSellOrderSign",
        P2PMessage::CompleteSellOrderProposal { .. } => "CompleteSellOrderProposal",
        P2PMessage::CompleteSellOrderSign { .. } => "CompleteSellOrderSign",
        P2PMessage::BurnSellOrderProposal { .. } => "BurnSellOrderProposal",
        P2PMessage::BurnSellOrderSign { .. } => "BurnSellOrderSign",
        P2PMessage::AssetTradesProposal { .. } => "AssetTradesProposal",
        P2PMessage::AssetTradesSign { .. } => "AssetTradesSign",
        P2PMessage::RecordCollateralMoveProposal { .. } => "RecordCollateralMoveProposal",
        P2PMessage::RecordCollateralMoveSign { .. } => "RecordCollateralMoveSign",
        P2PMessage::MintBridgedSharesProposal { .. } => "MintBridgedSharesProposal",
        P2PMessage::MintBridgedSharesSign { .. } => "MintBridgedSharesSign",
        P2PMessage::CompleteBuyOrderProposal { .. } => "CompleteBuyOrderProposal",
        P2PMessage::CompleteBuyOrderSign { .. } => "CompleteBuyOrderSign",
        P2PMessage::SetItpNavProposal { .. } => "SetItpNavProposal",
        P2PMessage::SetItpNavSign { .. } => "SetItpNavSign",
        P2PMessage::ArbitrationPriceProposal { .. } => "ArbitrationPriceProposal",
        P2PMessage::ArbitrationPriceVote { .. } => "ArbitrationPriceVote",
        P2PMessage::ArbitrationResolutionSign { .. } => "ArbitrationResolutionSign",
        P2PMessage::NavOracleProposal { .. } => "NavOracleProposal",
        P2PMessage::NavOracleSign { .. } => "NavOracleSign",
        P2PMessage::BatchConfigProposal { .. } => "BatchConfigProposal",
        P2PMessage::BatchConfigSign { .. } => "BatchConfigSign",
        P2PMessage::MirrorSyncProposal { .. } => "MirrorSyncProposal",
        P2PMessage::MirrorSyncSign { .. } => "MirrorSyncSign",
        P2PMessage::VisionTickProposal { .. } => "VisionTickProposal",
        P2PMessage::VisionTickSign { .. } => "VisionTickSign",
        P2PMessage::VisionCreditBalanceProposal { .. } => "VisionCreditBalanceProposal",
        P2PMessage::VisionCreditBalanceSign { .. } => "VisionCreditBalanceSign",
        P2PMessage::VisionCompleteDepositProposal { .. } => "VisionCompleteDepositProposal",
        P2PMessage::VisionCompleteDepositSign { .. } => "VisionCompleteDepositSign",
        P2PMessage::VisionRefundDepositProposal { .. } => "VisionRefundDepositProposal",
        P2PMessage::VisionRefundDepositSign { .. } => "VisionRefundDepositSign",
        P2PMessage::VisionCompleteWithdrawProposal { .. } => "VisionCompleteWithdrawProposal",
        P2PMessage::VisionCompleteWithdrawSign { .. } => "VisionCompleteWithdrawSign",
        P2PMessage::VisionCreateBatchProposal { .. } => "VisionCreateBatchProposal",
        P2PMessage::VisionCreateBatchSign { .. } => "VisionCreateBatchSign",
        P2PMessage::VisionBalanceProofsBatch { .. } => "VisionBalanceProofsBatch",
        P2PMessage::BitmapGossip { .. } => "BitmapGossip",
        P2PMessage::BitmapRequest { .. } => "BitmapRequest",
        P2PMessage::BitmapResponse { .. } => "BitmapResponse",
    }
}

/// Maximum total inbound connections (20 oracles + headroom for reconnections)
const MAX_INBOUND_CONNECTIONS: usize = 30;

/// Default per-IP connection limit (1 inbound + 1 outbound)
const DEFAULT_MAX_PER_IP: usize = 2;

/// Check if an IP address is loopback (127.x.x.x / ::1).
/// Loopback IPs are exempt from per-IP limits because local dev runs N oracles
/// on 127.0.0.1.
fn is_loopback(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => v4.is_loopback(),
        std::net::IpAddr::V6(v6) => v6.is_loopback(),
    }
}

/// TCP-based P2P transport for oracle nodes
///
/// Implements the [`P2PTransport`] trait using TCP connections with optional TLS.
/// Supports automatic reconnection with exponential backoff.
pub struct TcpP2PTransport {
    /// This node's peer ID
    peer_id: PeerId,
    /// Active peer connections
    connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
    /// Listen port for incoming connections
    listen_port: u16,
    /// Channel for incoming messages
    incoming_tx: mpsc::Sender<(PeerId, P2PMessage)>,
    /// Receiver for incoming messages (taken once by receive())
    incoming_rx: Arc<RwLock<Option<mpsc::Receiver<(PeerId, P2PMessage)>>>>,
    /// TLS configuration (None for plaintext)
    tls_config: Option<Arc<TlsConfig>>,
    /// Listener handle
    listener_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    /// Per-IP connection limit (0 = unlimited)
    max_per_ip: usize,
    /// Rate limit: tokens refilled per second per connection
    rate_limit: f64,
    /// Rate limit: maximum burst size (token bucket capacity)
    rate_burst: f64,
    /// Peer reputation scorer for auto-banning
    peer_scorer: Arc<PeerScorer>,
    /// Handle for the scorer tick background task
    scorer_tick_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    /// Optional P2P metrics for send counting (set once after construction)
    p2p_metrics: OnceLock<Arc<P2PMetrics>>,
    /// Channel for reader_loop to request reconnection when a connection drops.
    /// The drain task (started in start_reconnect_drain) processes these requests.
    reconnect_tx: mpsc::Sender<super::connection::ReconnectRequest>,
    /// Receiver for reconnect requests (taken once when drain task starts)
    reconnect_rx: Arc<RwLock<Option<mpsc::Receiver<super::connection::ReconnectRequest>>>>,
    /// Handle for the reconnect drain background task
    reconnect_drain_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

/// Default rate limit: 100 messages per second per peer
pub const DEFAULT_RATE_LIMIT: f64 = 100.0;

/// Default rate burst: 100 messages (token bucket capacity)
pub const DEFAULT_RATE_BURST: f64 = 100.0;

impl TcpP2PTransport {
    /// Create a new TCP P2P transport
    ///
    /// # Arguments
    /// * `peer_id` - This node's peer identifier
    /// * `listen_port` - Port to listen on for incoming connections
    /// * `tls_config` - Optional TLS configuration for secure connections
    /// * `max_per_ip` - Maximum connections from a single IP (0 = unlimited, default: 2)
    /// * `rate_limit` - Tokens refilled per second per connection (default: 100)
    /// * `rate_burst` - Maximum burst size / token bucket capacity (default: 100)
    pub fn new(
        peer_id: PeerId,
        listen_port: u16,
        tls_config: Option<TlsConfig>,
        max_per_ip: usize,
        rate_limit: f64,
        rate_burst: f64,
    ) -> Self {
        let (tx, rx) = mpsc::channel(1000);
        let (reconnect_tx, reconnect_rx) = mpsc::channel(32);

        Self {
            peer_id,
            connections: Arc::new(RwLock::new(HashMap::new())),
            listen_port,
            incoming_tx: tx,
            incoming_rx: Arc::new(RwLock::new(Some(rx))),
            tls_config: tls_config.map(Arc::new),
            listener_handle: Arc::new(RwLock::new(None)),
            max_per_ip,
            rate_limit,
            rate_burst,
            peer_scorer: Arc::new(PeerScorer::new()),
            scorer_tick_handle: Arc::new(RwLock::new(None)),
            p2p_metrics: OnceLock::new(),
            reconnect_tx,
            reconnect_rx: Arc::new(RwLock::new(Some(reconnect_rx))),
            reconnect_drain_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Attach P2P metrics so broadcast/send_to increment `messages_sent`.
    pub fn set_metrics(&self, metrics: Arc<P2PMetrics>) {
        let _ = self.p2p_metrics.set(metrics);
    }

    /// Return the attached P2P metrics handle, if set. Used by subsystems
    /// (WAL, equivocation detector) that want to publish their own counters
    /// under the same snapshot exposed via `/health`.
    pub fn metrics(&self) -> Option<Arc<P2PMetrics>> {
        self.p2p_metrics.get().cloned()
    }

    /// Get this node's peer ID
    pub fn peer_id(&self) -> PeerId {
        self.peer_id
    }

    /// Get the listen port
    pub fn listen_port(&self) -> u16 {
        self.listen_port
    }

    /// Check if TLS is enabled
    pub fn is_tls_enabled(&self) -> bool {
        self.tls_config.is_some()
    }

    /// Start listening for incoming connections
    ///
    /// This spawns a background task that accepts incoming connections
    /// and handles TLS handshake if configured.
    ///
    /// Connection limits are enforced atomically (single write-lock acquisition)
    /// before spawning the connection handler:
    /// - Total inbound connections capped at [`MAX_INBOUND_CONNECTIONS`]
    /// - Per-IP connections capped at `max_per_ip` (loopback IPs exempt)
    pub async fn start_listener(&self) -> Result<(), Error> {
        let addr: SocketAddr = format!("0.0.0.0:{}", self.listen_port)
            .parse()
            .map_err(|e| Error::P2PConnection(format!("Invalid address: {}", e)))?;

        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| Error::P2PConnection(format!("Failed to bind: {}", e)))?;

        info!(port = self.listen_port, max_per_ip = self.max_per_ip, "P2P listener started");

        let connections = self.connections.clone();
        let incoming_tx = self.incoming_tx.clone();
        let tls_config = self.tls_config.clone();
        let peer_id = self.peer_id;
        let max_per_ip = self.max_per_ip;
        let rate_limit = self.rate_limit;
        let rate_burst = self.rate_burst;

        let handle = tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        // --- Atomic check-and-accept under a single write lock ---
                        {
                            let conns = connections.read().await;

                            // 1. Global connection limit
                            if conns.len() >= MAX_INBOUND_CONNECTIONS {
                                warn!(
                                    code = "INFRA-021",
                                    conn_count = conns.len(),
                                    max = MAX_INBOUND_CONNECTIONS,
                                    %addr,
                                    "Max inbound connections reached, rejecting"
                                );
                                drop(stream);
                                continue;
                            }

                            // 2. Per-IP limit (skip for loopback — local dev runs N oracles on 127.0.0.1)
                            if max_per_ip > 0 && !is_loopback(&addr.ip()) {
                                let ip_count = conns
                                    .values()
                                    .filter(|c| c.addr().ip() == addr.ip())
                                    .count();
                                if ip_count >= max_per_ip {
                                    warn!(
                                        code = "INFRA-021",
                                        %addr,
                                        ip_count,
                                        max_per_ip,
                                        "Per-IP connection limit reached, rejecting"
                                    );
                                    drop(stream);
                                    continue;
                                }
                            }
                        }
                        // Lock released before spawning handler

                        debug!(%addr, "Accepted incoming connection");

                        let connections = connections.clone();
                        let incoming_tx = incoming_tx.clone();
                        let tls_config = tls_config.clone();

                        tokio::spawn(async move {
                            if let Err(e) = PeerConnection::accept_incoming(
                                stream,
                                addr,
                                connections,
                                incoming_tx,
                                tls_config,
                                peer_id,
                                rate_limit,
                                rate_burst,
                            )
                            .await
                            {
                                warn!(code = "INFRA-007", %addr, error = %e, "Failed to accept connection");
                            }
                        });
                    }
                    Err(e) => {
                        error!(code = "INFRA-007", error = %e, "Accept error");
                    }
                }
            }
        });

        *self.listener_handle.write().await = Some(handle);
        Ok(())
    }

    /// Stop the listener
    pub async fn stop_listener(&self) {
        if let Some(handle) = self.listener_handle.write().await.take() {
            handle.abort();
            info!("P2P listener stopped");
        }
    }

    /// Get connection status for all peers
    pub async fn get_peer_statuses(&self) -> HashMap<PeerId, ConnectionStatus> {
        let connections = self.connections.read().await;
        connections
            .iter()
            .map(|(id, conn)| (*id, conn.status()))
            .collect()
    }

    /// Get count of connected peers
    pub async fn connected_peer_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections
            .values()
            .filter(|c| c.status() == ConnectionStatus::Connected)
            .count()
    }

    /// Graceful shutdown - close all connections and stop listener
    pub async fn shutdown(&self) {
        info!("Shutting down P2P transport");

        // Stop scorer tick
        if let Some(handle) = self.scorer_tick_handle.write().await.take() {
            handle.abort();
        }

        // Stop reconnect drain
        if let Some(handle) = self.reconnect_drain_handle.write().await.take() {
            handle.abort();
        }

        // Stop listener
        self.stop_listener().await;

        // Close all connections
        let mut connections = self.connections.write().await;
        for (peer_id, conn) in connections.drain() {
            debug!(?peer_id, "Closing connection");
            conn.close().await;
        }

        info!("P2P transport shutdown complete");
    }

    /// Force-disconnect a peer by removing and closing its connection.
    pub async fn disconnect_peer(&self, peer_id: &PeerId) {
        let mut connections = self.connections.write().await;
        if let Some(conn) = connections.remove(peer_id) {
            info!(?peer_id, "Force-disconnecting peer");
            conn.close().await;
        }
    }

    /// Return the list of currently connected peer IDs.
    pub async fn connected_peer_ids(&self) -> Vec<PeerId> {
        let connections = self.connections.read().await;
        connections
            .iter()
            .filter(|(_, c)| c.status() == ConnectionStatus::Connected)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Get a reference to the peer scorer.
    pub fn peer_scorer(&self) -> &Arc<PeerScorer> {
        &self.peer_scorer
    }

    /// Start the background scorer tick timer (5-second interval).
    ///
    /// On each tick:
    /// 1. Collects connected peer IDs
    /// 2. Calls `scorer.tick()` to apply heartbeat penalties and detect bans
    /// 3. Force-disconnects any newly banned peers
    pub async fn start_scorer_tick(&self) {
        let connections = self.connections.clone();
        let scorer = self.peer_scorer.clone();

        let handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
            loop {
                interval.tick().await;

                // Collect connected peer IDs (short read-lock)
                let connected: Vec<PeerId> = {
                    let conns = connections.read().await;
                    conns
                        .iter()
                        .filter(|(_, c)| c.status() == ConnectionStatus::Connected)
                        .map(|(id, _)| *id)
                        .collect()
                };

                let to_ban = scorer.tick(&connected);

                // Disconnect banned peers
                for peer_id in &to_ban {
                    let mut conns = connections.write().await;
                    if let Some(conn) = conns.remove(peer_id) {
                        info!(?peer_id, "Disconnecting banned peer");
                        conn.close().await;
                    }
                }
            }
        });

        *self.scorer_tick_handle.write().await = Some(handle);
        info!("Peer scorer tick started (5s interval)");
    }

    /// Start the background task that drains reconnect requests from reader_loops.
    ///
    /// When a reader_loop detects a dead connection, it sends a `ReconnectRequest`
    /// through the channel. This task receives those requests and spawns
    /// `reconnect_loop` for each one, breaking the async type cycle that would
    /// occur if reader_loop called reconnect_loop directly.
    pub async fn start_reconnect_drain(&self) {
        let mut rx_guard = self.reconnect_rx.write().await;
        let rx = match rx_guard.take() {
            Some(rx) => rx,
            None => {
                warn!("Reconnect drain already started");
                return;
            }
        };

        let connections = self.connections.clone();
        let incoming_tx = self.incoming_tx.clone();
        let tls_config = self.tls_config.clone();
        let peer_id = self.peer_id;
        let rate_limit = self.rate_limit;
        let rate_burst = self.rate_burst;
        let peer_scorer = self.peer_scorer.clone();
        let reconnect_tx = self.reconnect_tx.clone();

        let handle = tokio::spawn(async move {
            let mut rx = rx;
            while let Some(req) = rx.recv().await {
                info!(?req.peer_id, %req.addr, "Processing reconnect request from reader_loop");

                let connections = connections.clone();
                let incoming_tx = incoming_tx.clone();
                let tls_config = tls_config.clone();
                let peer_scorer = Some(peer_scorer.clone());
                let reconnect_tx = reconnect_tx.clone();

                tokio::spawn(async move {
                    PeerConnection::reconnect_loop(
                        req.peer_id,
                        req.addr,
                        connections,
                        incoming_tx,
                        tls_config,
                        Some(peer_id),
                        rate_limit,
                        rate_burst,
                        peer_scorer,
                        Some(reconnect_tx),
                    )
                    .await;
                });
            }
        });

        *self.reconnect_drain_handle.write().await = Some(handle);
        info!("Reconnect drain task started");
    }
}

#[async_trait]
impl P2PTransport for TcpP2PTransport {
    async fn connect_peers(&self, peers: Vec<PeerInfo>) -> Result<(), Error> {
        for peer in peers {
            // Skip self
            if peer.peer_id == self.peer_id {
                continue;
            }

            // Connect to peer
            let addr: SocketAddr = format!("{}:{}", peer.ip, peer.port)
                .parse()
                .map_err(|e| Error::P2PConnection(format!("Invalid peer address: {}", e)))?;

            // When peer_id is unknown ([0u8;32], e.g. from on-chain discovery),
            // generate a unique temporary ID from the address so each peer gets
            // its own entry in the connection map. The reader_loop will re-key to
            // the real peer_id once the first message reveals the sender.
            let connection_key = if peer.peer_id == [0u8; 32] {
                temp_peer_id_from_addr(&addr, 0xFF)
            } else {
                peer.peer_id
            };

            // Check if already connected (using effective key)
            {
                let connections = self.connections.read().await;
                if connections.contains_key(&connection_key) {
                    debug!(?connection_key, "Already connected to peer");
                    continue;
                }
            }

            info!(?connection_key, %addr, "Connecting to peer");

            match PeerConnection::connect(
                connection_key,
                addr,
                self.connections.clone(),
                self.incoming_tx.clone(),
                self.tls_config.clone(),
                Some(self.peer_id),
                self.rate_limit,
                self.rate_burst,
                Some(self.reconnect_tx.clone()),
            )
            .await
            {
                Ok(conn) => {
                    let mut connections = self.connections.write().await;
                    connections.insert(connection_key, conn);
                    info!(?connection_key, %addr, "Connected to peer");
                }
                Err(e) => {
                    warn!(code = "INFRA-007", ?connection_key, %addr, error = %e, "Failed to connect to peer, will retry");
                    // Start reconnection in background
                    let connections = self.connections.clone();
                    let incoming_tx = self.incoming_tx.clone();
                    let tls_config = self.tls_config.clone();
                    let our_peer_id = self.peer_id;
                    let rate_limit = self.rate_limit;
                    let rate_burst = self.rate_burst;
                    let peer_scorer = Some(self.peer_scorer.clone());
                    let reconnect_tx = Some(self.reconnect_tx.clone());

                    tokio::spawn(async move {
                        PeerConnection::reconnect_loop(
                            connection_key,
                            addr,
                            connections,
                            incoming_tx,
                            tls_config,
                            Some(our_peer_id),
                            rate_limit,
                            rate_burst,
                            peer_scorer,
                            reconnect_tx,
                        )
                        .await;
                    });
                }
            }
        }

        Ok(())
    }

    async fn broadcast(&self, message: P2PMessage) -> Result<(), Error> {
        let connections = self.connections.read().await;
        let msg_type = msg_variant_name(&message);

        if connections.is_empty() {
            debug!(msg_type, "No peers connected for broadcast");
            return Ok(());
        }

        let peer_count = connections.len();
        let mut send_count: u64 = 0;
        let mut error_count: u64 = 0;

        for (peer_id, conn) in connections.iter() {
            if conn.status() != ConnectionStatus::Connected {
                let status = conn.status();
                warn!(code = "INFRA-007", ?peer_id, ?status, msg_type, "Broadcast skipped — peer not Connected");
                continue;
            }

            match conn.send(message.clone()).await {
                Ok(_) => {
                    send_count += 1;
                }
                Err(e) => {
                    warn!(code = "INFRA-024", ?peer_id, msg_type, error = %e, "Broadcast delivery failed to peer");
                    error_count += 1;
                }
            }
        }

        if let Some(m) = self.p2p_metrics.get() {
            m.messages_sent.fetch_add(send_count, std::sync::atomic::Ordering::Relaxed);
            if error_count > 0 {
                m.broadcast_send_failures.fetch_add(error_count, std::sync::atomic::Ordering::Relaxed);
            }
        }

        if error_count > 0 {
            warn!(
                code = "INFRA-024",
                msg_type,
                send_count,
                error_count,
                peer_count,
                "Broadcast partial failure — {}/{} peers unreachable",
                error_count,
                peer_count,
            );
        } else {
            debug!(msg_type, send_count, peer_count, "Broadcast delivered to all peers");
        }

        // Broadcast is best-effort, don't fail if some sends fail
        Ok(())
    }

    async fn send_to(&self, peer_id: PeerId, message: P2PMessage) -> Result<(), Error> {
        let connections = self.connections.read().await;
        let msg_type = msg_variant_name(&message);

        let conn = connections
            .get(&peer_id)
            .ok_or_else(|| {
                warn!(code = "INFRA-025", ?peer_id, msg_type, "send_to failed — peer not found");
                if let Some(m) = self.p2p_metrics.get() {
                    m.send_to_failures.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
                Error::P2PConnection(format!("Peer not found: {:?}", peer_id))
            })?;

        if conn.status() != ConnectionStatus::Connected {
            warn!(code = "INFRA-025", ?peer_id, msg_type, status = ?conn.status(), "send_to failed — peer not connected");
            if let Some(m) = self.p2p_metrics.get() {
                m.send_to_failures.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
            return Err(Error::P2PConnection(format!(
                "Peer not connected: {:?}",
                peer_id
            )));
        }

        let result = conn.send(message).await;
        if let Some(m) = self.p2p_metrics.get() {
            match &result {
                Ok(_) => {
                    m.messages_sent.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
                Err(e) => {
                    warn!(code = "INFRA-025", ?peer_id, msg_type, error = %e, "send_to failed — write error");
                    m.send_to_failures.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
            }
        }
        result
    }

    async fn receive(&self) -> Result<MessageStream, Error> {
        let mut rx_guard = self.incoming_rx.write().await;

        let rx = rx_guard.take().ok_or_else(|| {
            Error::P2PReceive("receive() can only be called once per transport instance".to_string())
        })?;

        let stream = async_stream::stream! {
            let mut rx = rx;
            while let Some((from, msg)) = rx.recv().await {
                yield Ok((from, msg));
            }
        };

        Ok(Box::pin(stream))
    }
}

impl Drop for TcpP2PTransport {
    fn drop(&mut self) {
        // Note: Proper cleanup should use shutdown() before drop
        // This is a fallback to abort the listener task
        if let Ok(mut handle) = self.listener_handle.try_write() {
            if let Some(h) = handle.take() {
                h.abort();
            }
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

    #[tokio::test]
    async fn test_transport_creation() {
        let transport = TcpP2PTransport::new(test_peer_id(1), 9001, None, DEFAULT_MAX_PER_IP, DEFAULT_RATE_LIMIT, DEFAULT_RATE_BURST);

        assert_eq!(transport.peer_id(), test_peer_id(1));
        assert_eq!(transport.listen_port(), 9001);
        assert!(!transport.is_tls_enabled());
    }

    #[tokio::test]
    async fn test_empty_broadcast_succeeds() {
        let transport = TcpP2PTransport::new(test_peer_id(1), 9002, None, DEFAULT_MAX_PER_IP, DEFAULT_RATE_LIMIT, DEFAULT_RATE_BURST);

        let msg = P2PMessage::Heartbeat {
            sender_id: test_peer_id(1),
            timestamp: 12345,
        };

        // Broadcast with no connections should succeed
        let result = transport.broadcast(msg).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_send_to_unknown_peer_fails() {
        let transport = TcpP2PTransport::new(test_peer_id(1), 9003, None, DEFAULT_MAX_PER_IP, DEFAULT_RATE_LIMIT, DEFAULT_RATE_BURST);

        let msg = P2PMessage::Heartbeat {
            sender_id: test_peer_id(1),
            timestamp: 12345,
        };

        // Send to unknown peer should fail
        let result = transport.send_to(test_peer_id(99), msg).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_receive_can_only_be_called_once() {
        let transport = TcpP2PTransport::new(test_peer_id(1), 9004, None, DEFAULT_MAX_PER_IP, DEFAULT_RATE_LIMIT, DEFAULT_RATE_BURST);

        // First call should succeed
        let result1 = transport.receive().await;
        assert!(result1.is_ok());

        // Second call should fail
        let result2 = transport.receive().await;
        assert!(result2.is_err());
    }

    /// Regression test for P2P bug: incoming connections must be stored for broadcasting
    ///
    /// Bug: `accept_incoming` created connections but never stored them in the
    /// `connections` map, causing broadcasts to fail with "No peers connected".
    /// Peers could receive messages (reader_loop worked) but couldn't send.
    ///
    /// This test verifies that when peer B connects TO peer A (incoming connection
    /// from A's perspective), peer A can broadcast back to B.
    #[tokio::test]
    async fn test_incoming_connection_stored_for_broadcast() {
        use tokio::time::{sleep, Duration};

        // Create two transports
        let transport_a = TcpP2PTransport::new(test_peer_id(1), 19001, None, DEFAULT_MAX_PER_IP, DEFAULT_RATE_LIMIT, DEFAULT_RATE_BURST);
        let transport_b = TcpP2PTransport::new(test_peer_id(2), 19002, None, DEFAULT_MAX_PER_IP, DEFAULT_RATE_LIMIT, DEFAULT_RATE_BURST);

        // Start listeners
        transport_a.start_listener().await.expect("A should start listener");
        transport_b.start_listener().await.expect("B should start listener");

        // B connects to A (creates incoming connection on A)
        let peers = vec![PeerInfo {
            peer_id: [0u8; 32], // Unknown peer_id, will be discovered
            ip: "127.0.0.1".to_string(),
            port: 19001,
        }];
        transport_b.connect_peers(peers).await.expect("B should connect to A");

        // Wait for connection establishment and identification
        sleep(Duration::from_millis(500)).await;

        // CRITICAL: A must have the incoming connection stored for broadcast
        // This is what the bug prevented - A had 0 connections for broadcast
        let a_peer_count = transport_a.connected_peer_count().await;
        assert!(
            a_peer_count > 0,
            "BUG REGRESSION: Transport A has no peers for broadcast! \
             Incoming connections are not being stored in the connections map. \
             Check that accept_incoming() inserts the connection after setup."
        );

        // Verify A can broadcast (this would fail with the bug)
        let msg = P2PMessage::Heartbeat {
            sender_id: test_peer_id(1),
            timestamp: 12345,
        };
        let broadcast_result = transport_a.broadcast(msg).await;
        assert!(
            broadcast_result.is_ok(),
            "Transport A should be able to broadcast to incoming connections"
        );

        // Cleanup
        transport_a.shutdown().await;
        transport_b.shutdown().await;
    }
}
