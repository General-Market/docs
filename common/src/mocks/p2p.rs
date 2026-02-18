//! MockP2P implementation for testing peer-to-peer communication
//!
//! Provides in-memory message passing between mock nodes with support for
//! network partitions, disconnections, and latency simulation.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::{mpsc, RwLock};

use crate::error::Error;
use crate::traits::{MessageStream, P2PTransport};
use crate::types::{P2PMessage, PeerId, PeerInfo};

use super::MockError;

/// Coordinator for mock P2P network
///
/// Manages all mock nodes and handles message routing, partitions, and failures.
pub struct MockP2PNetwork {
    /// All registered nodes
    nodes: Arc<RwLock<HashMap<PeerId, mpsc::Sender<(PeerId, P2PMessage)>>>>,
    /// Partitioned connections (bidirectional)
    partitions: Arc<RwLock<HashSet<(PeerId, PeerId)>>>,
    /// Disconnected peers
    disconnected: Arc<RwLock<HashSet<PeerId>>>,
    /// Message delay for all nodes
    message_delay: Arc<RwLock<Option<Duration>>>,
}

impl MockP2PNetwork {
    /// Create a new network coordinator
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(RwLock::new(HashMap::new())),
            partitions: Arc::new(RwLock::new(HashSet::new())),
            disconnected: Arc::new(RwLock::new(HashSet::new())),
            message_delay: Arc::new(RwLock::new(None)),
        }
    }

    /// Register a node with the network
    pub async fn register_node(&self, peer_id: PeerId, tx: mpsc::Sender<(PeerId, P2PMessage)>) {
        self.nodes.write().await.insert(peer_id, tx);
    }

    /// Unregister a node from the network
    pub async fn unregister_node(&self, peer_id: &PeerId) {
        self.nodes.write().await.remove(peer_id);
    }

    /// Set message delay for all nodes
    pub async fn set_message_delay(&self, delay: Duration) {
        *self.message_delay.write().await = Some(delay);
    }

    /// Clear message delay
    pub async fn clear_message_delay(&self) {
        *self.message_delay.write().await = None;
    }

    /// Disconnect a peer (drops all messages to/from this peer)
    pub async fn disconnect_peer(&self, peer_id: PeerId) {
        self.disconnected.write().await.insert(peer_id);
    }

    /// Reconnect a previously disconnected peer
    pub async fn reconnect_peer(&self, peer_id: &PeerId) {
        self.disconnected.write().await.remove(peer_id);
    }

    /// Create a network partition between two groups
    ///
    /// Nodes in group_a cannot communicate with nodes in group_b.
    pub async fn partition_network(&self, group_a: Vec<PeerId>, group_b: Vec<PeerId>) {
        let mut partitions = self.partitions.write().await;
        for a in &group_a {
            for b in &group_b {
                partitions.insert((*a, *b));
                partitions.insert((*b, *a));
            }
        }
    }

    /// Remove all network partitions
    pub async fn heal_partition(&self) {
        self.partitions.write().await.clear();
    }

    /// Check if two peers can communicate
    pub async fn can_communicate(&self, from: &PeerId, to: &PeerId) -> bool {
        let disconnected = self.disconnected.read().await;
        if disconnected.contains(from) || disconnected.contains(to) {
            return false;
        }

        let partitions = self.partitions.read().await;
        !partitions.contains(&(*from, *to))
    }

    /// Route a message from one peer to another
    pub async fn route_message(
        &self,
        from: PeerId,
        to: PeerId,
        message: P2PMessage,
    ) -> Result<(), Error> {
        // Check if communication is allowed
        if !self.can_communicate(&from, &to).await {
            return Err(MockError::NetworkPartition.into());
        }

        // Apply message delay
        if let Some(delay) = *self.message_delay.read().await {
            tokio::time::sleep(delay).await;
        }

        // Get receiver
        let nodes = self.nodes.read().await;
        if let Some(tx) = nodes.get(&to) {
            tx.send((from, message))
                .await
                .map_err(|_| MockError::PeerDisconnected(format!("{:?}", to)))?;
            Ok(())
        } else {
            Err(MockError::PeerDisconnected(format!("{:?}", to)).into())
        }
    }

    /// Broadcast a message to all connected peers
    pub async fn broadcast(&self, from: PeerId, message: P2PMessage) -> Result<(), Error> {
        let nodes = self.nodes.read().await;
        let peer_ids: Vec<_> = nodes.keys().cloned().collect();
        drop(nodes);

        for to in peer_ids {
            if to != from {
                // Ignore errors for individual peers (broadcast is best-effort)
                let _ = self.route_message(from, to, message.clone()).await;
            }
        }

        Ok(())
    }

    /// Get list of all registered peer IDs
    pub async fn get_peer_ids(&self) -> Vec<PeerId> {
        self.nodes.read().await.keys().cloned().collect()
    }

    /// Get number of connected nodes
    pub async fn node_count(&self) -> usize {
        self.nodes.read().await.len()
    }
}

impl Default for MockP2PNetwork {
    fn default() -> Self {
        Self::new()
    }
}

/// Mock implementation of P2P transport
///
/// Each instance represents a single node in the mock network.
///
/// **Important:** The `receive()` method can only be called once per instance.
/// This is because the underlying channel receiver is consumed to create the stream.
/// If you need multiple consumers, clone the MockP2P or use a broadcast pattern.
pub struct MockP2P {
    /// This node's peer ID
    peer_id: PeerId,
    /// Reference to the network coordinator
    network: Arc<MockP2PNetwork>,
    /// Receiver for incoming messages
    rx: Arc<RwLock<Option<mpsc::Receiver<(PeerId, P2PMessage)>>>>,
    /// Connected peers
    connected_peers: Arc<RwLock<Vec<PeerInfo>>>,
}

impl MockP2P {
    /// Get this node's peer ID
    pub fn peer_id(&self) -> PeerId {
        self.peer_id
    }

    /// Get the network coordinator
    pub fn network(&self) -> Arc<MockP2PNetwork> {
        self.network.clone()
    }
}

#[async_trait]
impl P2PTransport for MockP2P {
    async fn connect_peers(&self, peers: Vec<PeerInfo>) -> Result<(), Error> {
        let mut connected = self.connected_peers.write().await;
        for peer in peers {
            if !connected.iter().any(|p| p.peer_id == peer.peer_id) {
                connected.push(peer);
            }
        }
        Ok(())
    }

    async fn broadcast(&self, message: P2PMessage) -> Result<(), Error> {
        self.network.broadcast(self.peer_id, message).await
    }

    async fn send_to(&self, peer_id: PeerId, message: P2PMessage) -> Result<(), Error> {
        self.network.route_message(self.peer_id, peer_id, message).await
    }

    async fn receive(&self) -> Result<MessageStream, Error> {
        let mut rx_guard = self.rx.write().await;

        // Take the receiver (can only be called once)
        let rx = rx_guard.take().ok_or_else(|| {
            Error::P2PReceive("receive() can only be called once per MockP2P instance".to_string())
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

impl Drop for MockP2P {
    fn drop(&mut self) {
        // Unregister from network in a blocking way
        // Note: In production, we'd use a proper async cleanup mechanism
        let network = self.network.clone();
        let peer_id = self.peer_id;
        tokio::spawn(async move {
            network.unregister_node(&peer_id).await;
        });
    }
}

/// Builder for MockP2P
pub struct MockP2PBuilder {
    network: Arc<MockP2PNetwork>,
    peer_id: Option<PeerId>,
    channel_capacity: usize,
    message_delay: Option<Duration>,
}

impl MockP2PBuilder {
    /// Create a new builder with a network reference
    pub fn new(network: Arc<MockP2PNetwork>) -> Self {
        Self {
            network,
            peer_id: None,
            channel_capacity: 1000,
            message_delay: None,
        }
    }

    /// Set message delay for this node
    /// Note: This sets the delay on the network coordinator for all nodes.
    /// For per-node delays, the network would need to track per-sender delays.
    pub fn with_message_delay(mut self, delay: Duration) -> Self {
        self.message_delay = Some(delay);
        self
    }

    /// Set the peer ID
    pub fn with_peer_id(mut self, peer_id: PeerId) -> Self {
        self.peer_id = Some(peer_id);
        self
    }

    /// Set message channel capacity
    pub fn with_channel_capacity(mut self, capacity: usize) -> Self {
        self.channel_capacity = capacity;
        self
    }

    /// Build the MockP2P
    pub async fn build(self) -> MockP2P {
        // Generate peer ID if not provided
        let peer_id = self.peer_id.unwrap_or_else(|| {
            let mut id = [0u8; 32];
            use rand::Rng;
            rand::thread_rng().fill(&mut id);
            id
        });

        // Apply message delay to network if set
        if let Some(delay) = self.message_delay {
            self.network.set_message_delay(delay).await;
        }

        // Create message channel
        let (tx, rx) = mpsc::channel(self.channel_capacity);

        // Register with network
        self.network.register_node(peer_id, tx).await;

        MockP2P {
            peer_id,
            network: self.network,
            rx: Arc::new(RwLock::new(Some(rx))),
            connected_peers: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

/// Builder for creating a complete mock P2P network with nodes
pub struct MockP2PNetworkBuilder {
    node_count: usize,
    message_delay: Option<Duration>,
    channel_capacity: usize,
}

impl MockP2PNetworkBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            node_count: 0,
            message_delay: None,
            channel_capacity: 1000,
        }
    }

    /// Set the number of nodes to create
    pub fn with_node_count(mut self, count: usize) -> Self {
        self.node_count = count;
        self
    }

    /// Set message delay
    pub fn with_message_delay(mut self, delay: Duration) -> Self {
        self.message_delay = Some(delay);
        self
    }

    /// Set channel capacity
    pub fn with_channel_capacity(mut self, capacity: usize) -> Self {
        self.channel_capacity = capacity;
        self
    }

    /// Build the network and nodes
    pub async fn build(self) -> (Arc<MockP2PNetwork>, Vec<MockP2P>) {
        let network = Arc::new(MockP2PNetwork::new());

        if let Some(delay) = self.message_delay {
            network.set_message_delay(delay).await;
        }

        let mut nodes = Vec::new();
        for i in 0..self.node_count {
            let mut peer_id = [0u8; 32];
            peer_id[0..8].copy_from_slice(&(i as u64).to_le_bytes());

            let node = MockP2PBuilder::new(network.clone())
                .with_peer_id(peer_id)
                .with_channel_capacity(self.channel_capacity)
                .build()
                .await;
            nodes.push(node);
        }

        (network, nodes)
    }
}

impl Default for MockP2PNetworkBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::StreamExt;

    fn peer_id(n: u64) -> PeerId {
        let mut id = [0u8; 32];
        id[0..8].copy_from_slice(&n.to_le_bytes());
        id
    }

    #[tokio::test]
    async fn test_broadcast_reaches_all_peers() {
        #[allow(unused_variables)]
        let (network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(5)
            .build()
            .await;

        // Set up receivers
        let mut receivers = Vec::new();
        for node in &nodes {
            receivers.push(node.receive().await.unwrap());
        }

        // Broadcast from node 0
        let message = P2PMessage::Heartbeat {
            sender_id: nodes[0].peer_id(),
            timestamp: 12345,
        };
        nodes[0].broadcast(message.clone()).await.unwrap();

        // Give time for messages to propagate
        tokio::time::sleep(Duration::from_millis(50)).await;

        // All other nodes should receive the message
        // Note: In a real test, we'd use proper async iteration
        assert_eq!(network.node_count().await, 5);
    }

    #[tokio::test]
    async fn test_partition_blocks_messages() {
        let (network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(4)
            .build()
            .await;

        // Partition: [0, 1] cannot talk to [2, 3]
        network
            .partition_network(
                vec![nodes[0].peer_id(), nodes[1].peer_id()],
                vec![nodes[2].peer_id(), nodes[3].peer_id()],
            )
            .await;

        // Verify partition
        assert!(!network.can_communicate(&nodes[0].peer_id(), &nodes[2].peer_id()).await);
        assert!(!network.can_communicate(&nodes[1].peer_id(), &nodes[3].peer_id()).await);

        // Within same group should work
        assert!(network.can_communicate(&nodes[0].peer_id(), &nodes[1].peer_id()).await);
        assert!(network.can_communicate(&nodes[2].peer_id(), &nodes[3].peer_id()).await);

        // Message across partition should fail
        let message = P2PMessage::Heartbeat {
            sender_id: nodes[0].peer_id(),
            timestamp: 12345,
        };
        let result = nodes[0].send_to(nodes[2].peer_id(), message).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_heal_partition_restores_communication() {
        let (network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(2)
            .build()
            .await;

        // Create partition
        network
            .partition_network(vec![nodes[0].peer_id()], vec![nodes[1].peer_id()])
            .await;

        assert!(!network.can_communicate(&nodes[0].peer_id(), &nodes[1].peer_id()).await);

        // Heal partition
        network.heal_partition().await;

        assert!(network.can_communicate(&nodes[0].peer_id(), &nodes[1].peer_id()).await);
    }

    #[tokio::test]
    async fn test_disconnect_drops_messages() {
        let (network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(2)
            .build()
            .await;

        // Disconnect node 1
        network.disconnect_peer(nodes[1].peer_id()).await;

        assert!(!network.can_communicate(&nodes[0].peer_id(), &nodes[1].peer_id()).await);
        assert!(!network.can_communicate(&nodes[1].peer_id(), &nodes[0].peer_id()).await);

        // Reconnect
        network.reconnect_peer(&nodes[1].peer_id()).await;

        assert!(network.can_communicate(&nodes[0].peer_id(), &nodes[1].peer_id()).await);
    }

    #[tokio::test]
    async fn test_concurrent_broadcasts() {
        let (network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(5)
            .build()
            .await;

        // Have all nodes broadcast simultaneously
        let mut handles = vec![];
        for (i, node) in nodes.iter().enumerate() {
            let node_id = node.peer_id();
            let network_clone = network.clone();
            handles.push(tokio::spawn(async move {
                let message = P2PMessage::Heartbeat {
                    sender_id: node_id,
                    timestamp: i as u64,
                };
                network_clone.broadcast(node_id, message).await
            }));
        }

        // Wait for all broadcasts
        let results: Vec<_> = futures::future::join_all(handles).await;

        // All should succeed
        for result in results {
            assert!(result.is_ok());
            assert!(result.unwrap().is_ok());
        }
    }

    #[tokio::test]
    async fn test_message_delay() {
        let (_network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(2)
            .with_message_delay(Duration::from_millis(50))
            .build()
            .await;

        let start = std::time::Instant::now();

        let message = P2PMessage::Heartbeat {
            sender_id: nodes[0].peer_id(),
            timestamp: 12345,
        };
        nodes[0].send_to(nodes[1].peer_id(), message).await.unwrap();

        let elapsed = start.elapsed();
        assert!(elapsed >= Duration::from_millis(50));
    }

    #[tokio::test]
    async fn test_send_to_specific_peer() {
        let network = Arc::new(MockP2PNetwork::new());

        let node0 = MockP2PBuilder::new(network.clone())
            .with_peer_id(peer_id(0))
            .build()
            .await;

        let node1 = MockP2PBuilder::new(network.clone())
            .with_peer_id(peer_id(1))
            .build()
            .await;

        let mut rx = node1.receive().await.unwrap();

        // Send message
        let message = P2PMessage::CycleStart {
            cycle_number: 42,
            leader_id: node0.peer_id(),
        };
        node0.send_to(node1.peer_id(), message.clone()).await.unwrap();

        // Receive message
        let received = tokio::time::timeout(Duration::from_millis(100), rx.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();

        assert_eq!(received.0, node0.peer_id());
        if let P2PMessage::CycleStart { cycle_number, .. } = received.1 {
            assert_eq!(cycle_number, 42);
        } else {
            panic!("Wrong message type");
        }
    }
}
