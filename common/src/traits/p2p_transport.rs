//! P2PTransport trait for peer-to-peer communication

use async_trait::async_trait;
use futures::stream::BoxStream;

use crate::error::Error;
use crate::types::{P2PMessage, PeerId, PeerInfo};

/// Stream of incoming P2P messages
pub type MessageStream = BoxStream<'static, Result<(PeerId, P2PMessage), Error>>;

/// Trait for P2P transport layer
/// Handles peer connections and message passing
#[async_trait]
pub trait P2PTransport: Send + Sync {
    /// Connect to a list of peers
    ///
    /// # Arguments
    /// * `peers` - List of peer information to connect to
    async fn connect_peers(&self, peers: Vec<PeerInfo>) -> Result<(), Error>;

    /// Broadcast a message to all connected peers
    ///
    /// # Arguments
    /// * `message` - Message to broadcast
    async fn broadcast(&self, message: P2PMessage) -> Result<(), Error>;

    /// Send a message to a specific peer
    ///
    /// # Arguments
    /// * `peer_id` - Target peer identifier
    /// * `message` - Message to send
    async fn send_to(&self, peer_id: PeerId, message: P2PMessage) -> Result<(), Error>;

    /// Receive incoming messages as a stream
    ///
    /// # Returns
    /// Stream of (sender_id, message) tuples
    async fn receive(&self) -> Result<MessageStream, Error>;
}
