//! Peer connection management
//!
//! Handles individual TCP connections to peers with automatic reconnection.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

use common::error::Error;
use common::types::{P2PMessage, PeerId};

use super::codec::{self, Codec};
use super::rate_limit::RateBucket;
use super::tls::{P2PStream, TlsConfig};

/// Reconnection configuration
const INITIAL_BACKOFF_MS: u64 = 100;
const MAX_BACKOFF_MS: u64 = 5000;
const BACKOFF_MULTIPLIER: u64 = 2;

/// Connection status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ConnectionStatus {
    /// Connection is active
    Connected = 0,
    /// Connection was lost
    Disconnected = 1,
    /// Currently attempting to reconnect
    Reconnecting = 2,
}

impl From<u8> for ConnectionStatus {
    fn from(v: u8) -> Self {
        match v {
            0 => ConnectionStatus::Connected,
            1 => ConnectionStatus::Disconnected,
            2 => ConnectionStatus::Reconnecting,
            _ => ConnectionStatus::Disconnected,
        }
    }
}

/// Represents a connection to a peer
pub struct PeerConnection {
    /// Peer identifier
    peer_id: PeerId,
    /// Remote address
    addr: SocketAddr,
    /// Connection status (atomic for thread-safe access)
    status: AtomicU8,
    /// Sender for outgoing messages
    outgoing_tx: mpsc::Sender<P2PMessage>,
    /// Handle to the writer task
    writer_handle: Option<tokio::task::JoinHandle<()>>,
    /// Handle to the reader task
    reader_handle: Option<tokio::task::JoinHandle<()>>,
}

impl PeerConnection {
    /// Get the peer ID
    pub fn peer_id(&self) -> PeerId {
        self.peer_id
    }

    /// Get the remote address
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// Get the current connection status
    pub fn status(&self) -> ConnectionStatus {
        ConnectionStatus::from(self.status.load(Ordering::Relaxed))
    }

    /// Set the connection status
    fn set_status(&self, status: ConnectionStatus) {
        self.status.store(status as u8, Ordering::Relaxed);
    }

    /// Send a message to this peer
    pub async fn send(&self, message: P2PMessage) -> Result<(), Error> {
        self.outgoing_tx
            .send(message)
            .await
            .map_err(|_| Error::P2PBroadcast("Connection closed".to_string()))
    }

    /// Close the connection
    pub async fn close(self) {
        if let Some(handle) = self.writer_handle {
            handle.abort();
        }
        if let Some(handle) = self.reader_handle {
            handle.abort();
        }
    }

    /// Connect to a peer
    pub async fn connect(
        peer_id: PeerId,
        addr: SocketAddr,
        connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
        incoming_tx: mpsc::Sender<(PeerId, P2PMessage)>,
        tls_config: Option<Arc<TlsConfig>>,
        our_peer_id: Option<PeerId>,
        rate_limit: f64,
        rate_burst: f64,
    ) -> Result<PeerConnection, Error> {
        debug!(?peer_id, %addr, "Connecting to peer");

        let stream = TcpStream::connect(addr)
            .await
            .map_err(|e| Error::P2PConnection(format!("Connection failed: {}", e)))?;

        let conn = Self::setup_connection(peer_id, addr, stream, connections, incoming_tx, tls_config, false, rate_limit, rate_burst)
            .await?;

        // Send heartbeat to identify ourselves to the remote peer
        if let Some(our_id) = our_peer_id {
            let identify_msg = P2PMessage::Heartbeat {
                sender_id: our_id,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            };
            if let Err(e) = conn.send(identify_msg).await {
                warn!(error = %e, "Failed to send identification heartbeat");
            }
        }

        Ok(conn)
    }

    /// Accept an incoming connection
    pub async fn accept_incoming(
        stream: TcpStream,
        addr: SocketAddr,
        connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
        incoming_tx: mpsc::Sender<(PeerId, P2PMessage)>,
        tls_config: Option<Arc<TlsConfig>>,
        our_peer_id: PeerId,
        rate_limit: f64,
        rate_burst: f64,
    ) -> Result<(), Error> {
        debug!(%addr, "Setting up incoming connection");

        // For incoming connections, we need to receive the peer ID first
        // This is handled in the read loop after TLS handshake

        // Create a unique temporary peer ID from the remote address
        // (avoids collisions when multiple peers connect simultaneously)
        let temp_peer_id = temp_peer_id_from_addr(&addr, 0xFE);

        let conn = Self::setup_connection(
            temp_peer_id,
            addr,
            stream,
            connections.clone(),
            incoming_tx,
            tls_config,
            true,
            rate_limit,
            rate_burst,
        )
        .await?;

        // We need to send our peer ID to identify ourselves
        let identify_msg = P2PMessage::Heartbeat {
            sender_id: our_peer_id,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };
        conn.send(identify_msg).await?;

        // Store the connection with the temporary peer ID
        // The reader_loop will re-key it to the real peer ID once identified
        {
            let mut conns = connections.write().await;
            conns.insert(temp_peer_id, conn);
        }
        debug!(?temp_peer_id, %addr, "Stored incoming connection");

        Ok(())
    }

    /// Set up a connection (shared between connect and accept)
    async fn setup_connection(
        peer_id: PeerId,
        addr: SocketAddr,
        stream: TcpStream,
        connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
        incoming_tx: mpsc::Sender<(PeerId, P2PMessage)>,
        tls_config: Option<Arc<TlsConfig>>,
        is_server: bool,
        rate_limit: f64,
        rate_burst: f64,
    ) -> Result<PeerConnection, Error> {
        // Apply TLS if configured, otherwise wrap as plaintext
        let stream: P2PStream = if let Some(config) = tls_config {
            config.wrap_stream(stream, is_server).await?
        } else {
            P2PStream::Plain { inner: stream }
        };

        let (read_half, write_half) = tokio::io::split(stream);

        // Create message channel for outgoing messages
        let (outgoing_tx, outgoing_rx) = mpsc::channel::<P2PMessage>(100);

        // Spawn writer task
        let writer_handle = tokio::spawn(Self::writer_loop(write_half, outgoing_rx));

        // Create per-connection rate bucket
        let rate_bucket = RateBucket::new(rate_burst, rate_limit);

        // Spawn reader task
        let reader_handle = tokio::spawn(Self::reader_loop(
            read_half,
            peer_id,
            incoming_tx,
            connections.clone(),
            addr,
            rate_bucket,
        ));

        Ok(PeerConnection {
            peer_id,
            addr,
            status: AtomicU8::new(ConnectionStatus::Connected as u8),
            outgoing_tx,
            writer_handle: Some(writer_handle),
            reader_handle: Some(reader_handle),
        })
    }

    /// Writer loop - sends outgoing messages
    async fn writer_loop<W: AsyncWriteExt + Unpin>(
        mut writer: W,
        mut outgoing_rx: mpsc::Receiver<P2PMessage>,
    ) {
        while let Some(message) = outgoing_rx.recv().await {
            match codec::encode(&message) {
                Ok(bytes) => {
                    if let Err(e) = writer.write_all(&bytes).await {
                        error!(code = "INFRA-008", error = %e, "Write error");
                        break;
                    }
                    if let Err(e) = writer.flush().await {
                        error!(code = "INFRA-008", error = %e, "Flush error");
                        break;
                    }
                }
                Err(e) => {
                    error!(code = "INFRA-008", error = %e, "Encode error");
                }
            }
        }
        debug!("Writer loop ended");
    }

    /// Reader loop - receives incoming messages
    async fn reader_loop<R: AsyncReadExt + Unpin>(
        mut reader: R,
        peer_id: PeerId,
        incoming_tx: mpsc::Sender<(PeerId, P2PMessage)>,
        connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
        addr: SocketAddr,
        mut rate_bucket: RateBucket,
    ) {
        let mut codec = Codec::new();
        let mut buf = [0u8; 4096];
        let mut actual_peer_id = peer_id;

        loop {
            match reader.read(&mut buf).await {
                Ok(0) => {
                    // Connection closed
                    info!(?actual_peer_id, "Connection closed by peer");
                    break;
                }
                Ok(n) => {
                    codec.feed(&buf[..n]);

                    while let Some(result) = codec.decode_next() {
                        match result {
                            Ok(message) => {
                                // Rate limit check: drop message if bucket empty
                                if !rate_bucket.try_consume() {
                                    warn!(
                                        code = "INFRA-020",
                                        ?actual_peer_id,
                                        %addr,
                                        "Rate limit exceeded, dropping message"
                                    );
                                    continue;
                                }

                                // If this connection has a temporary peer_id (not yet
                                // identified), extract the actual peer ID from the message
                                // and re-key the connection map entry.
                                if is_temp_peer_id(&actual_peer_id) {
                                    if let Some(sender_id) = get_sender_id(&message) {
                                        let old_id = actual_peer_id;
                                        actual_peer_id = sender_id;
                                        info!(?actual_peer_id, %addr, "Identified peer");

                                        // Update the connection map with the real peer ID
                                        let mut conns = connections.write().await;
                                        if let Some(conn) = conns.remove(&old_id) {
                                            conns.insert(actual_peer_id, conn);
                                        }
                                    }
                                }

                                if let Err(e) = incoming_tx.send((actual_peer_id, message)).await {
                                    error!(code = "INFRA-009", error = %e, "Failed to forward message");
                                    return;
                                }
                            }
                            Err(e) => {
                                error!(code = "INFRA-009", error = %e, "Decode error");
                            }
                        }
                    }
                }
                Err(e) => {
                    error!(code = "INFRA-009", error = %e, "Read error");
                    break;
                }
            }
        }

        // Mark connection as disconnected
        let conns = connections.read().await;
        if let Some(conn) = conns.get(&actual_peer_id) {
            conn.set_status(ConnectionStatus::Disconnected);
        }
    }

    /// Reconnection loop with exponential backoff.
    ///
    /// If a `peer_scorer` is provided, the loop checks `is_banned()` before
    /// each attempt and aborts reconnection to banned peers.
    pub async fn reconnect_loop(
        peer_id: PeerId,
        addr: SocketAddr,
        connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
        incoming_tx: mpsc::Sender<(PeerId, P2PMessage)>,
        tls_config: Option<Arc<TlsConfig>>,
        our_peer_id: Option<PeerId>,
        rate_limit: f64,
        rate_burst: f64,
        peer_scorer: Option<Arc<super::peer_scoring::PeerScorer>>,
    ) {
        let mut backoff_ms = INITIAL_BACKOFF_MS;

        loop {
            // Wait for ban to expire before attempting reconnection
            if let Some(ref scorer) = peer_scorer {
                if scorer.is_banned(&peer_id) {
                    debug!(?peer_id, "Peer is banned, waiting before retry");
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    continue;
                }
            }

            // Check if already connected
            {
                let conns = connections.read().await;
                if let Some(conn) = conns.get(&peer_id) {
                    if conn.status() == ConnectionStatus::Connected {
                        debug!(?peer_id, "Already reconnected");
                        return;
                    }
                }
            }

            info!(?peer_id, backoff_ms, "Attempting reconnection");

            tokio::time::sleep(Duration::from_millis(backoff_ms)).await;

            match Self::connect(
                peer_id,
                addr,
                connections.clone(),
                incoming_tx.clone(),
                tls_config.clone(),
                our_peer_id,
                rate_limit,
                rate_burst,
            )
            .await
            {
                Ok(conn) => {
                    let mut conns = connections.write().await;
                    conns.insert(peer_id, conn);
                    info!(?peer_id, "Reconnected successfully");
                    return;
                }
                Err(e) => {
                    warn!(code = "INFRA-007", ?peer_id, error = %e, backoff_ms, "Reconnection failed");
                    backoff_ms = (backoff_ms * BACKOFF_MULTIPLIER).min(MAX_BACKOFF_MS);
                }
            }
        }
    }
}

/// Check if a peer ID is a temporary placeholder (not yet identified via handshake)
///
/// Temporary peer IDs use specific prefix bytes:
/// - 0xFE: Incoming connections before identity is established
/// - 0xFF: Outgoing connections from discovery before handshake
///
/// Note: We don't treat all-zeros as temp because node_id=0 (bls-key-seed-index=0)
/// legitimately produces peer_id starting with 0x00.
fn is_temp_peer_id(id: &PeerId) -> bool {
    id[0] == 0xFF || id[0] == 0xFE
}

/// Generate a unique temporary peer ID from a socket address.
/// Uses 0xFE prefix for incoming connections and 0xFF for outgoing (discovery-based).
pub fn temp_peer_id_from_addr(addr: &SocketAddr, prefix: u8) -> PeerId {
    let mut temp_id = [0u8; 32];
    temp_id[0] = prefix;
    let port_bytes = addr.port().to_be_bytes();
    temp_id[1] = port_bytes[0];
    temp_id[2] = port_bytes[1];
    // Encode IP octets
    match addr.ip() {
        std::net::IpAddr::V4(ip) => {
            temp_id[3..7].copy_from_slice(&ip.octets());
        }
        std::net::IpAddr::V6(ip) => {
            temp_id[3..19].copy_from_slice(&ip.octets());
        }
    }
    temp_id
}

/// Extract sender ID from a P2P message
fn get_sender_id(message: &P2PMessage) -> Option<PeerId> {
    match message {
        P2PMessage::CycleStart { leader_id, .. } => Some(*leader_id),
        P2PMessage::PriceProposal { .. } => None, // No explicit sender
        P2PMessage::PriceVote { voter_id, .. } => Some(*voter_id),
        P2PMessage::BatchProposal { .. } => None, // No explicit sender
        P2PMessage::BatchSign { signer_id, .. } => Some(*signer_id),
        P2PMessage::Heartbeat { sender_id, .. } => Some(*sender_id),
        P2PMessage::KickVote { voter_id, .. } => Some(*voter_id),
        // Story 6.21: ITP creation messages now include sender IDs for proper routing
        P2PMessage::ItpCreationProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::ItpCreationSign { signer_id, .. } => Some(*signer_id),
        // Story 7.2: Bridge Arb→L3 messages include sender IDs for proper routing
        P2PMessage::BridgeArbToL3Proposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::BridgeArbToL3Sign { signer_id, .. } => Some(*signer_id),
        // Story 7.3: Submit Order for User messages include sender IDs
        P2PMessage::SubmitOrderForUserProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::SubmitOrderForUserSign { signer_id, .. } => Some(*signer_id),
        // Story 7.4: Batch and Fill confirmation messages include sender IDs
        P2PMessage::ConfirmBatchProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::ConfirmBatchSign { signer_id, .. } => Some(*signer_id),
        P2PMessage::ConfirmFillsProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::ConfirmFillsSign { signer_id, .. } => Some(*signer_id),
        // Story 7.5: Bridge L3→Arb messages include sender IDs for proper routing
        P2PMessage::BridgeL3ToArbProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::BridgeL3ToArbSign { signer_id, .. } => Some(*signer_id),
        // Story 7.6: Custody release to vault messages include sender IDs
        P2PMessage::ReleaseToVaultProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::ReleaseToVaultSign { signer_id, .. } => Some(*signer_id),
        // Story 7-14: Rebalance consensus messages include sender IDs
        P2PMessage::RebalanceBatchProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::RebalanceBatchSign { signer_id, .. } => Some(*signer_id),
        P2PMessage::UpdateWeightsProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::UpdateWeightsSign { signer_id, .. } => Some(*signer_id),
        // Cross-chain rebalance request messages
        P2PMessage::RebalanceRequestProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::RebalanceRequestSign { signer_id, .. } => Some(*signer_id),
        // Single-phase rebalance consensus
        P2PMessage::RebalanceProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::RebalanceSign { signer_id, .. } => Some(*signer_id),
        // Issuer-driven per-asset settlement
        P2PMessage::AssetTradesProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::AssetTradesSign { signer_id, .. } => Some(*signer_id),
        // Cross-chain sell flow
        P2PMessage::SubmitSellOrderProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::SubmitSellOrderSign { signer_id, .. } => Some(*signer_id),
        P2PMessage::CompleteSellOrderProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::CompleteSellOrderSign { signer_id, .. } => Some(*signer_id),
        // 8-step bridge: RecordCollateralMove + MintBridgedShares
        P2PMessage::RecordCollateralMoveProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::RecordCollateralMoveSign { signer_id, .. } => Some(*signer_id),
        P2PMessage::MintBridgedSharesProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::MintBridgedSharesSign { signer_id, .. } => Some(*signer_id),
        // completeBuyOrder BLS consensus
        P2PMessage::CompleteBuyOrderProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::CompleteBuyOrderSign { signer_id, .. } => Some(*signer_id),
        // Rebalance NAV consensus: setItpNav
        P2PMessage::SetItpNavProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::SetItpNavSign { signer_id, .. } => Some(*signer_id),
        // Cross-chain buy completion
        P2PMessage::CompleteBuyOrderProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::CompleteBuyOrderSign { signer_id, .. } => Some(*signer_id),
        // AA keeper arbitration consensus
        P2PMessage::ArbitrationPriceProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::ArbitrationPriceVote { voter_id, .. } => Some(*voter_id),
        P2PMessage::ArbitrationResolutionSign { signer_id, .. } => Some(*signer_id),
        // NAV oracle (ITPNAVOracle on Arb)
        P2PMessage::NavOracleProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::NavOracleSign { signer_id, .. } => Some(*signer_id),
        // MirrorIssuerRegistry sync (Step 12)
        P2PMessage::MirrorSyncProposal { leader_id, .. } => Some(*leader_id),
        P2PMessage::MirrorSyncSign { signer_id, .. } => Some(*signer_id),
        // Batch config orchestrator (independent from settlement cycle)
        P2PMessage::BatchConfigProposal { .. } => None, // No explicit sender field
        P2PMessage::BatchConfigSign { .. } => None,     // No explicit sender field
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_status_conversion() {
        assert_eq!(ConnectionStatus::from(0), ConnectionStatus::Connected);
        assert_eq!(ConnectionStatus::from(1), ConnectionStatus::Disconnected);
        assert_eq!(ConnectionStatus::from(2), ConnectionStatus::Reconnecting);
        assert_eq!(ConnectionStatus::from(255), ConnectionStatus::Disconnected);
    }

    #[test]
    fn test_backoff_constants() {
        assert_eq!(INITIAL_BACKOFF_MS, 100);
        assert_eq!(MAX_BACKOFF_MS, 5000);

        // Verify backoff sequence: 100 -> 200 -> 400 -> 800 -> 1600 -> 3200 -> 5000 (capped)
        let mut backoff = INITIAL_BACKOFF_MS;
        let sequence: Vec<u64> = (0..7)
            .map(|_| {
                let current = backoff;
                backoff = (backoff * BACKOFF_MULTIPLIER).min(MAX_BACKOFF_MS);
                current
            })
            .collect();

        assert_eq!(sequence, vec![100, 200, 400, 800, 1600, 3200, 5000]);
    }
}
